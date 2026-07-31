import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSpeechSession, isSpeechSupported } from '@/lib/speech'
import '@/index.css'

// Map a speech error code to a user-facing message.
function errorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser site settings, then try again.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'network':
      return 'Voice input needs an internet connection, and only works in Google Chrome.'
    case 'no-speech':
      return 'No speech detected. Try again.'
    case 'no-gcp-tab':
      return 'Open the Google Cloud Console tab to use voice input.'
    case 'no-content-script':
      return 'Reload the Google Cloud Console tab, then try voice input again.'
    case 'not-supported':
      return "Voice input isn't supported in this browser."
    default:
      return 'Voice input failed. Try again.'
  }
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onMic,
  placeholder = 'Ask anything...',
  className,
}) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState(null)
  const [supported] = useState(isSpeechSupported)

  const sessionRef = useRef(null)
  const textareaRef = useRef(null)

  // Latest value ref — kept in sync via effect so handleMic can read the
  // current text without being listed as a dependency and rebuilt on every keystroke.
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  // -----------------------------
  // Auto resize textarea
  // -----------------------------
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [value, resizeTextarea])

  // Stop any in-progress recognition when the input unmounts.
  useEffect(() => () => sessionRef.current?.stop(), [])

  // -----------------------------
  // Mic toggle
  // -----------------------------
  const stopRecording = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
    setRecording(false)
    onMic?.(false)
  }, [onMic])

  const handleMic = useCallback(() => {
    if (sessionRef.current) {
      stopRecording()
      return
    }

    setError(null)

    // Picks the right strategy automatically: in-page Web Speech on localhost,
    // or the content script on the active GCP tab in the packed extension.
    const session = createSpeechSession({
      onTranscript: (text) => onChange?.(text),
      onError: (code) => {
        if (sessionRef.current !== session) return
        sessionRef.current = null
        setRecording(false)
        onMic?.(false)
        setError(errorMessage(code))
      },
      onEnd: () => {
        if (sessionRef.current !== session) return
        sessionRef.current = null
        setRecording(false)
        onMic?.(false)
      },
    })

    sessionRef.current = session
    setRecording(true)
    onMic?.(true)
    session.start(valueRef.current ?? '')
  }, [onChange, onMic, stopRecording])

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div
      className={cn(
        'border-border bg-background flex flex-col gap-2 border-t px-3 py-3',
        className,
      )}
    >
      {/* Recording animation */}
      {recording && (
        <div className="flex h-8 items-center gap-[2px] px-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="animated-waveBar flex-1 rounded-sm bg-red-500"
              style={{
                height: '3px',
                animation: 'waveBar 0.7s ease-in-out infinite',
                animationDelay: `${(i * 0.035).toFixed(3)}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <div
          className={cn(
            'bg-muted flex flex-1 items-start gap-2 rounded-full px-4 py-2',
            'border transition-colors',
            recording ? 'border-red-400/50' : 'border-border',
          )}
        >
          {recording && (
            <span className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={recording}
            placeholder={placeholder}
            rows={1}
            onInput={resizeTextarea}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend?.()
              }
            }}
            className="placeholder:text-muted-foreground max-h-32 flex-1 resize-none overflow-hidden bg-transparent text-sm focus:outline-none"
          />

          {recording && (
            <span className="h-3.5 w-[2px] animate-[blink_1s_step-end_infinite] rounded-sm bg-red-500" />
          )}
        </div>

        {/* Mic */}
        <button
          onClick={handleMic}
          disabled={!supported}
          aria-label={recording ? 'Stop voice input' : 'Start voice input'}
          title={supported ? undefined : "Voice input isn't supported in this browser"}
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-all',
            recording ? 'animate-pulse bg-red-500' : 'bg-primary hover:opacity-90',
            !supported && 'cursor-not-allowed opacity-40 hover:opacity-40',
          )}
        >
          <Mic size={16} />
        </button>

        {/* Send */}
        <button
          onClick={onSend}
          className="border-border text-muted-foreground hover:bg-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
        >
          <ArrowRight size={16} />
        </button>
      </div>

      {recording && (
        <p className="text-center text-[11px] text-red-500">Recording — tap mic to stop</p>
      )}

      {!recording && error && (
        <p className="text-center text-[11px] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
