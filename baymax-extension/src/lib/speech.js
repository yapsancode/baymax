// Speech-to-text sessions for the "Ask anything" input.
//
// Two strategies, chosen automatically by context:
//
//   local  — Web Speech API in the current page. Used on localhost dev, where
//            the page can prompt for the mic directly.
//
//   remote — the packed-extension SIDE PANEL cannot get the microphone: its
//            chrome-extension:// origin never shows the mic prompt, and the Web
//            Speech backend isn't reachable from it. So recognition is offloaded
//            to the content script running on the active console.cloud.google.com
//            tab (a real https origin where the prompt works AND Chrome's speech
//            key is available). Transcripts stream back over a Port.
//            See src/content/voice.js for the other end.
//
// Both strategies expose the same shape: { start(baseText), stop() } and report
// through onTranscript(fullText) / onError(code) / onEnd().

const GCP_ORIGIN = /^https:\/\/console\.cloud\.google\.com/

// Are we the packed-extension side panel (has chrome.tabs to reach the content script)?
function isExtensionSidePanel() {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.tabs?.connect
}

// Best-effort synchronous support check, used to enable/disable the mic button.
// In the extension the real answer comes from the content script at runtime, so
// we optimistically return true and let onError surface 'not-supported'.
export function isSpeechSupported() {
  if (isExtensionSidePanel()) return true
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

function join(base, addition) {
  if (!addition) return base
  return base ? `${base} ${addition}` : addition
}

// --- local: Web Speech API in this page (localhost dev) ---
function createLocalSession({ onTranscript, onError, onEnd }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  let recognition = null
  let active = false
  let base = ''
  let accumulated = ''

  return {
    async start(baseText) {
      if (!SpeechRecognition) return onError('not-supported')

      // Explicitly request the mic first so a denied/blocked permission becomes a
      // clear message instead of a mic that silently does nothing.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch (err) {
        return onError(err?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')
      }

      base = baseText ?? ''
      accumulated = ''
      recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          if (event.results[i].isFinal) accumulated = join(accumulated, t)
          else interim = t
        }
        onTranscript(join(base, join(accumulated, interim)))
      }

      recognition.onerror = (event) => {
        if (event.error === 'aborted') return
        onError(event.error)
      }

      recognition.onend = () => {
        // Continuous mode times out periodically; restart while still active.
        if (active) {
          try {
            recognition.start()
            return
          } catch {
            /* ignore */
          }
        }
        onEnd()
      }

      active = true
      try {
        recognition.start()
      } catch {
        active = false
        onError('start-failed')
      }
    },

    stop() {
      active = false
      recognition?.stop()
    },
  }
}

// --- remote: recognition runs in the content script on the active GCP tab ---
function createRemoteSession({ onTranscript, onError, onEnd }) {
  let port = null
  let base = ''
  let ended = false

  const finish = () => {
    if (ended) return
    ended = true
    onEnd()
  }

  return {
    async start(baseText) {
      base = baseText ?? ''

      let tab
      try {
        ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      } catch {
        /* ignore */
      }

      if (!tab || !GCP_ORIGIN.test(tab.url || '')) return onError('no-gcp-tab')

      try {
        port = chrome.tabs.connect(tab.id, { name: 'baymax-voice' })
      } catch {
        return onError('no-content-script')
      }

      port.onMessage.addListener((msg) => {
        if (msg?.type === 'transcript') onTranscript(join(base, msg.text))
        else if (msg?.type === 'error') onError(msg.error)
        else if (msg?.type === 'end') finish()
      })

      port.onDisconnect.addListener(() => {
        // Fires when the content script is missing (page loaded before the
        // extension, or not a GCP tab) — chrome.runtime.lastError is set then.
        if (chrome.runtime?.lastError) onError('no-content-script')
        port = null
        finish()
      })
    },

    stop() {
      try {
        port?.postMessage({ action: 'STOP_VOICE' })
      } catch {
        /* ignore */
      }
      try {
        port?.disconnect()
      } catch {
        /* ignore */
      }
      port = null
    },
  }
}

export function createSpeechSession(handlers) {
  return isExtensionSidePanel() ? createRemoteSession(handlers) : createLocalSession(handlers)
}

// --- text-to-speech voice guide ---
//
// Primary: Gemini TTS via the backend (POST /tts — the Baymax voice: Alnilam +
// a calm-robot style prompt, both configured server-side). Fallback: the
// browser's speechSynthesis, so the voice guide keeps working offline or when
// the backend is down.
//
// Audio blobs are cached per spoken text, so re-visiting a step (or the steps
// array being swapped for a content-equivalent copy) replays instantly without
// another API call.

import { api } from '@/lib/api'

const audioCache = new Map() // text -> object URL of the WAV blob
const AUDIO_CACHE_MAX = 40

let currentAudio = null
// Incremented by every speakText/stopSpeaking call. A fetch that resolves
// after a newer call (step advanced, voice muted, page unmounted) sees a stale
// generation and must not start playing over the newer announcement.
let generation = 0

// Playback speed — a single module-level rate applied to whichever path is
// active (Gemini audio's playbackRate, or the browser voice's utterance.rate),
// so cycling it once affects future speech regardless of which one answers.
const SPEECH_RATES = [1, 1.25, 1.5, 1.75, 2]
let rateIndex = 0

export function getSpeechRate() {
  return SPEECH_RATES[rateIndex]
}

// Advances to the next rate (wrapping around) and applies it to audio already
// playing, so changing speed mid-sentence takes effect immediately instead of
// waiting for the next step's announcement. Returns the new rate for the
// caller to render. speechSynthesis has no live-rate API, so an in-progress
// browser-voice utterance only picks up the new rate on its next call.
export function cycleSpeechRate() {
  rateIndex = (rateIndex + 1) % SPEECH_RATES.length
  const rate = SPEECH_RATES[rateIndex]
  if (currentAudio) currentAudio.playbackRate = rate
  return rate
}

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis
}

function speakWithBrowserVoice(text) {
  if (!isSpeechSynthesisSupported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = getSpeechRate()
  window.speechSynthesis.speak(utterance)
}

async function getAudioUrl(text) {
  let url = audioCache.get(text)
  if (url) return url
  const blob = await api.synthesizeSpeech(text)
  url = URL.createObjectURL(blob)
  if (audioCache.size >= AUDIO_CACHE_MAX) {
    // Drop the oldest entry (Map preserves insertion order).
    const [oldText, oldUrl] = audioCache.entries().next().value
    URL.revokeObjectURL(oldUrl)
    audioCache.delete(oldText)
  }
  audioCache.set(text, url)
  return url
}

// Speaks the given text aloud, cancelling any speech already in progress.
// Fire-and-forget: callers don't await it.
export async function speakText(text) {
  if (!text) return
  stopSpeaking()
  const gen = ++generation

  try {
    const url = await getAudioUrl(text)
    if (gen !== generation) return // superseded while fetching
    const audio = new Audio(url)
    audio.playbackRate = getSpeechRate()
    currentAudio = audio
    await audio.play()
  } catch {
    if (gen !== generation) return
    speakWithBrowserVoice(text)
  }
}

export function stopSpeaking() {
  generation++ // invalidate any in-flight speakText fetch
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}
