// Active Session screen — chat-driven step guidance.
// The current step is rendered as a card inside the first AI bubble.
//
// Drives the Cloud SQL for PostgreSQL guide (src/lib/guides/cloudSqlPostgres.js):
// each step is highlighted on the active console.cloud.google.com tab via
// src/lib/guide.js — pulsing outline plus the animated mascot pointing at the
// element — and read aloud via src/lib/speech.js.
//
// Step completion is tracked three ways, any of which auto-advances the guide:
//  - the user clicks the highlighted element (BAYMAX_GUIDE_CLICKED)
//  - the user types into the highlighted input (BAYMAX_GUIDE_FILLED)
//  - the tab URL changes to the page the step leads to (advanceOnUrlPattern)
// Progress is persisted in localStorage so closing the panel resumes the guide.

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, PencilLine } from 'lucide-react'
import { api } from '@/lib/api'
import {
  Button,
  ChatInput,
  TaskStepCard,
  TaskStepCardPlaceholder,
  ChatThread,
} from '@/components/ui'
import { CLOUD_SQL_POSTGRES_GUIDE } from '@/lib/guides/cloudSqlPostgres'
import GuidanceComplete from './Complete'
import {
  highlightStep,
  showLostMascot,
  runStepAction,
  clearGuideHighlight,
  onGuideStepEvent,
  onGcpUrlChanged,
  stepCompletedByUrl,
  getCurrentGcpUrl,
  isOnStepPage,
  goToStepPage,
  goToUrl,
  openGcpConsole,
  resetGuidedTab,
  captureChatPage,
  // captureSnapshot, // SELF-HEAL DISABLED
} from '@/lib/guide'
import {
  speakText,
  stopSpeaking,
  isSpeechSynthesisSupported,
  getSpeechRate,
  cycleSpeechRate,
} from '@/lib/speech'

// Progress has ONE source of truth: the backend step `status` (see markStepStatus
// below). Resume happens only through the backend (resumeSession → listSteps),
// so there is no localStorage progress store — it used to be a second, competing
// source keyed by guide id, which meant every task and re-run of the same guide
// shared one key and a fresh start inherited the last run's abandoned step.

const HIGHLIGHT_RETRIES = 6
const HIGHLIGHT_RETRY_MS = 700

// After "Open the Cloud Console" connects/creates/reloads the tab, how long to
// keep retrying the highlight while the (heavy) console page loads.
const CONSOLE_OPEN_RETRIES = 10
const CONSOLE_OPEN_RETRY_MS = 1500

const STATUS_MESSAGES = {
  'no-gcp-tab': 'Open console.cloud.google.com in this window so Baymax can guide that tab.',
  'no-content-script': "Couldn't reach the Cloud Console tab — try reloading it.",
  'not-found': "Couldn't find this on the page yet. Navigate there manually, then try again.",
}

// Shown while the self-heal round-trip runs: the authored selector missed, so
// Baymax is snapshotting the page and asking the backend which element it maps
// to now (see tryRepair).
// SELF-HEAL DISABLED
// const HEALING_MESSAGE = 'Baymax is re-reading the page to find this step…'

const OFF_TRACK_MESSAGE =
  'You\'ve navigated away from this step\'s page — no rush. "Take me back" (here or on Baymax) jumps you right back to it.'

const HIDDEN_MESSAGE = 'Baymax is hidden — press "Show me" to bring him back.'

// Shown when an awaitNavigation step (the final "Create instance" submit) was
// clicked but the page didn't move on — i.e. GCP rejected the form.
const SUBMIT_BLOCKED_MESSAGE =
  'That didn\'t create the instance yet — Google flagged some fields. Fix the highlighted errors (e.g. a duplicate instance name, or a password that doesn\'t meet the rules), then click "Create instance" again.'

// How long to wait after a submit click before deciding it failed. A successful
// create navigates to the instances list well within this; a rejected one stays
// put showing errors.
const SUBMIT_VERIFY_MS = 2200

// Short encouragements Baymax holds up on his sign board, rotated per step.
const CHEERS = [
  "Let's do this together! 🤖",
  "You're doing great! 💪",
  'Nice and easy — one step at a time 🐾',
  'Great progress! 🌟',
  'Halfway hero — keep going! 🚀',
  "You've got this! ✨",
  'Almost there! 🏁',
  'So close now! 🔥',
  'Last step — amazing work! 🎉',
]

export default function Guidance({
  sessionId,
  guide,
  // Set only when this run is a TRIAL of a recorded draft ("Try it now"):
  // returns to the Recorder, whose draft is still intact. Shown mid-run (bail
  // out the moment a step misbehaves) and on the completion screen.
  onBackToRecorder,
  onNewTask,
  onComplete,
  // Page-aware chat preference, owned by App (toggled from the header icon).
  pageShare = false,
}) {
  // An explicit `guide` (e.g. one just recorded) takes precedence over the
  // backend session.
  const defaultGuide = CLOUD_SQL_POSTGRES_GUIDE
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [currentGuide, setCurrentGuide] = useState(() => guide || defaultGuide)
  // Always start at step 0. A resumed session moves the index in the load effect
  // once the backend statuses come back; a fresh run genuinely starts at 1.
  const [stepIndex, setStepIndex] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceRate, setVoiceRate] = useState(getSpeechRate)
  const [automating, setAutomating] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [offTrack, setOffTrack] = useState(false)
  // Set when the current step's element couldn't be found after every retry AND
  // the step declares a `fallbackUrl` — holds { url, hint }, which turns the
  // off-track banner into a "Take me there" shortcut to the step's destination
  // instead of a dead-end error. See the fallbackUrl note in cloudSqlPostgres.js.
  const [fallback, setFallback] = useState(null)
  // True while "Open the Cloud Console" is connecting a tab + waiting for the
  // console to load enough to highlight the step.
  const [openingConsole, setOpeningConsole] = useState(false)
  const [steps, setSteps] = useState([])
  const [stepsLoading, setStepsLoading] = useState(false)
  // Set once the final step is done — swaps the step UI for the celebration screen.
  const [completed, setCompleted] = useState(false)
  // Outcome of the finished run, read from the final step's status in finish():
  // true = clean finish (Success mascot), false = the last step was marked
  // failed (Error mascot). Drives which mascot the Complete screen shows.
  const [runSuccess, setRunSuccess] = useState(true)
  // Step numbers (1-based) already reported via thumbs-down this run — guards
  // against duplicate POST /feedback calls for the same step/session.
  const [failedSteps, setFailedSteps] = useState(() => new Set())
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  // Clamp the active index to the loaded steps. A resumed index can point past
  // the end of `steps` (e.g. resuming a session that now has fewer steps), which
  // made `steps[stepIndex]` undefined and crashed the whole panel on `step.title`.
  // Clamping keeps the derived values in range; the effect below snaps the index
  // back so it stays consistent.
  const safeStepIndex = steps.length ? Math.min(stepIndex, steps.length - 1) : 0
  const step = steps[safeStepIndex]
  const stepNumber = safeStepIndex + 1
  const isLastStep = safeStepIndex === steps.length - 1

  useEffect(() => {
    if (steps.length > 0 && stepIndex > steps.length - 1) setStepIndex(steps.length - 1)
  }, [steps, stepIndex])

  // Keep the header title in sync with the local guide (it changes identity
  // when App.jsx merges backend step ids in — same title, fresh object).
  // Deliberately does NOT reset stepIndex: the id-merge fires this mid-run, and
  // a fresh guide always arrives on a fresh mount (Guidance unmounts whenever
  // the screen leaves 'guidance'), which starts at 0 anyway.
  useEffect(() => {
    if (guide) setCurrentGuide(guide)
  }, [guide])

  const mascotExtras = {
    stepNumber,
    totalSteps: steps.length,
    cheer: CHEERS[stepIndex % CHEERS.length],
  }

  const advancedRef = useRef(false)
  // Set when the user presses Back, so the URL-based auto-advance/auto-skip
  // (notably step 4's autoSkip) doesn't immediately bounce them forward again
  // while the tab is still parked on a later page. Cleared on any forward move.
  const backPressedRef = useRef(false)
  const hiddenRef = useRef(false)
  // High-water mark: the furthest step the user has ever reached this session.
  // URL-based auto-skip (advanceOnUrlPattern) exists to skip steps the page has
  // genuinely moved past — but it must only do so at the FRONTIER (the furthest
  // step, or when resuming mid-journey at mount). Once the user presses Back to
  // redo earlier steps, those steps sit BELOW the frontier; the page is still
  // parked on a later wizard screen, so every step whose advanceOnUrlPattern that
  // stale URL satisfies would otherwise cascade-skip forward (back to step 1 then
  // forward shoots straight to step 5/6). Below the frontier we therefore advance
  // only on real interaction (click/fill) or the Next button — one step at a time.
  const maxReachedRef = useRef(stepIndex)
  // A FRESH run (a local guide was passed in) must always start at step 1: the
  // Console tab is usually still parked on whatever page the PREVIOUS run left
  // behind (e.g. /run/create after abandoning Cloud Run at step 4), and the
  // mount-time catch-up would cascade-skip every step that stale URL satisfies
  // — a brand-new session landing on step 4 before the user touched anything.
  // So on fresh runs, URL-based auto-advance stays disabled until the tab
  // actually navigates. Resumed sessions (no `guide` prop) keep the mount-time
  // catch-up: jumping forward to where the page already is, is the point there.
  const freshRunRef = useRef(Boolean(guide?.steps))
  const navigatedSinceMountRef = useRef(false)
  // Pending "did the submit actually work?" check for an awaitNavigation step.
  const submitTimerRef = useRef(null)
  // Live mirror of stepIndex, so delayed callbacks (Do it for me's advance
  // timer) can tell whether the guide already moved on since they were armed.
  const stepIndexRef = useRef(stepIndex)
  // Live mirror of `fallback`, for the same reason: the lost mascot's onGoBack
  // is registered ONCE per step — while fallback is still null — so reading the
  // state through that stale closure would send "click me and I'll take you
  // straight there" down the history-back path instead. setFallbackBoth keeps
  // the two in step.
  const fallbackRef = useRef(null)
  // SELF-HEAL DISABLED — self-heal cache refs commented out.
  // Self-heal cache, keyed by step index. healedRef holds the resolver-intent
  // override the backend returned for a step whose selector stopped matching;
  // healAttemptedRef stops us re-running the (LLM) repair every retry tick.
  // const healedRef = useRef({})
  // const healAttemptedRef = useRef({})
  useEffect(() => {
    stepIndexRef.current = stepIndex
    advancedRef.current = false
    hiddenRef.current = false
    if (stepIndex > maxReachedRef.current) maxReachedRef.current = stepIndex
    clearTimeout(submitTimerRef.current)
  }, [stepIndex])
  // True only when the guide is at (or beyond) the furthest step reached, i.e.
  // genuinely new ground rather than a step the user walked back to re-do.
  const atFrontier = () => stepIndex >= maxReachedRef.current

  // Always set the escape hatch through here — the ref is what the mascot's
  // callback reads, the state is what the card renders.
  const setFallbackBoth = (value) => {
    fallbackRef.current = value
    setFallback(value)
  }

  // Merge any self-heal override for the current step onto its intent. The
  // override never touches `selector` (kept as the progress-report key the
  // click/fill watchers compare against) — it only adds the backend's grounded
  // hints (extraSelector + name/role/text/href) and loosens the strict matchers
  // so the resolver can find the moved element.
  // SELF-HEAL DISABLED — pass the step through untouched (no healed override).
  const applyHeal = (s) => {
    // const override = healedRef.current[stepIndex]
    // return override ? { ...s, ...override } : s
    return s
  }

  // SELF-HEAL DISABLED — the LLM repair round-trip below is commented out.
  /*
  // Snapshot the page and ask the backend which live element this failing step
  // now maps to. Returns an intent override to merge, or null (no match, backend
  // down, not in the extension) — in which case the caller falls back to the
  // existing "navigate there manually" message, so nothing regresses.
  const tryRepair = async (s) => {
    try {
      const snap = await captureSnapshot()
      if (!snap?.ok || !snap.elements?.length) return null
      const goal = guide?.title ?? CLOUD_SQL_POSTGRES_GUIDE.title
      const res = await api.repairStep({
        goal,
        url: snap.url,
        step: {
          title: s.title || '',
          description: s.description || '',
          action: s.action || '',
          role: s.role || '',
          name: s.name || '',
          text: s.text || '',
          href: s.href || '',
          selector: s.selector || '',
        },
        elements: snap.elements,
      })
      const it = res?.ok ? res.intent : null
      if (!it || (!it.selector && !it.name)) return null
      // Build a complete targeting override. We clear name/text/href the backend
      // didn't supply so a stale authored name can't make the resolver reject the
      // freshly-found element (its name-must-match rule). The grounded live
      // selector rides in `extraSelector`.
      return {
        name: it.name || undefined,
        role: it.role || s.role || undefined,
        text: it.text || undefined,
        href: it.href || undefined,
        extraSelector: it.selector || undefined,
        exactName: false,
        requireSelector: false,
      }
    } catch (err) {
      console.error('Self-heal failed:', err.message)
      return null
    }
  }
  */

  // Persist the current step index to the backend (fire-and-forget).
  // A no-op without a session (recorded guides / offline).
  const saveStepIndex = (index) => {
    if (!sessionId) return
    api.updateSession(sessionId, { current_step_index: index }).catch(() => {})
  }

  const goNext = () => {
    clearGuideHighlight()
    // A forward move clears the "just pressed Back" guard so URL-based
    // auto-skip works normally again from here on.
    backPressedRef.current = false
    if (isLastStep) {
      finish()
      return
    }
    const nextIndex = Math.min(safeStepIndex + 1, steps.length - 1)
    saveStepIndex(nextIndex)
    setStepIndex(nextIndex)
  }

  // Report the current step as a thumbs-down (step-level failure feedback).
  // Non-blocking: never touches guide navigation, and a failed request just
  // reverts the optimistic "recorded" state so the user can retry.
  const handleThumbsDown = () => {
    if (!step || failedSteps.has(stepNumber) || feedbackSubmitting) return
    setFeedbackSubmitting(true)
    setFailedSteps((prev) => new Set(prev).add(stepNumber))
    api
      .submitStepFeedback({
        session_id: sessionId ?? null,
        guide_id: currentGuide?.id ?? guide?.id ?? CLOUD_SQL_POSTGRES_GUIDE.id,
        guide_title: currentGuide?.title ?? guide?.title ?? CLOUD_SQL_POSTGRES_GUIDE.title,
        step_index: stepNumber,
        step_title: step.title,
        status: 'fail',
      })
      .catch(() => {
        setFailedSteps((prev) => {
          const next = new Set(prev)
          next.delete(stepNumber)
          return next
        })
      })
      .finally(() => setFeedbackSubmitting(false))
  }

  // Finish the guide: clear the on-page highlight + voice, mark the last step and
  // the session complete, and show the celebration screen.
  const finish = () => {
    clearGuideHighlight()
    stopSpeaking()
    // The final step's status decides the outcome: a thumbs-down on the last
    // step (tracked in failedSteps) means the run reached the end but didn't
    // land cleanly — the Complete screen then shows the Error mascot.
    const succeeded = !failedSteps.has(stepNumber)
    setRunSuccess(succeeded)
    if (sessionId) {
      api
        .updateSession(sessionId, { status: 'completed', current_step_index: steps.length })
        .catch(() => {})
      // Implicit success reporting: the final step is reported as success
      // (skipped if it already has feedback for this session). Sessionless
      // runs (recorder trials/offline guides) still don't report feedback.
      // Skipped entirely when the final step failed — reporting a success
      // completion for a run that didn't land would be wrong.
      if (succeeded) {
        api
          .submitCompletionFeedback({
            session_id: sessionId,
            guide_id: currentGuide?.id ?? guide?.id ?? CLOUD_SQL_POSTGRES_GUIDE.id,
            guide_title: currentGuide?.title ?? guide?.title ?? CLOUD_SQL_POSTGRES_GUIDE.title,
            steps: steps.map((s, i) => ({ step_index: i + 1, step_title: s.title })),
          })
          .catch(() => {})
      }
    }
    setCompleted(true)
  }

  const goPrev = () => {
    clearGuideHighlight()
    // Walking back to re-do an earlier step: suppress URL-based auto-advance/
    // auto-skip until the next forward move, so a stale later-page URL doesn't
    // immediately bounce the user forward again (see backPressedRef).
    backPressedRef.current = true
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const autoAdvance = () => {
    if (advancedRef.current) return
    advancedRef.current = true
    goNext()
  }

  // For a submit step (awaitNavigation): the user clicked "Create instance", but
  // that alone doesn't prove success. Wait a beat — if the tab navigated to the
  // instances list, onGcpUrlChanged already advanced us (success). If we're still
  // on the form, GCP rejected it, so keep the user here and tell them to fix the
  // flagged fields instead of falsely celebrating.
  const verifySubmit = () => {
    clearTimeout(submitTimerRef.current)
    setStatusMessage('')
    submitTimerRef.current = setTimeout(async () => {
      if (advancedRef.current) return
      const tabInfo = await getCurrentGcpUrl()
      if (tabInfo?.ok && stepCompletedByUrl(step, tabInfo.url)) return
      setStatusMessage(SUBMIT_BLOCKED_MESSAGE)
    }, SUBMIT_VERIFY_MS)
  }

  // Load steps. Local steps (a guide passed from App — the built-in mock, a
  // recorded guide, or an AI blueprint) are authoritative for navigation: the
  // backend session copy is lossy (schemas/step.py drops the resolver fields —
  // name, exactName, avoidText, awaitNavigation, ...), so it must never replace
  // them, even when sessionId arrives mid-run. Fetch from the backend only when
  // resuming a session, where the saved copy is the only source we have.
  useEffect(() => {
    if (guide?.steps) {
      setSteps(guide.steps)
      return
    }
    if (!sessionId) {
      setSteps(CLOUD_SQL_POSTGRES_GUIDE.steps)
      return
    }

    setStepsLoading(true)
    ;(async () => {
      try {
        const data = await api.listSteps(sessionId)
        let resolved = data
        let resumeIndex = 0
        try {
          const sess = await api.getSession(sessionId)
          resumeIndex = sess?.current_step_index ?? 0
          // The saved step copy is LOSSY — StepCreate drops the resolver fields
          // (name, exactName, role, avoidText, revealSelector, ...), so a step
          // that resolves by name alone (e.g. Cloud Run's "Test with a sample
          // container", which has no stable selector) can NEVER be found again
          // when run from this copy. Sessions are created with the guide's
          // title, so rehydrate the full steps from the source guide and keep
          // the backend step ids. No match (AI blueprints, a deleted guide) or
          // any fetch failure falls back to the saved copy — same as before.
          const summaries = await api.listGuides()
          const source = summaries.find((g) => g.title === sess?.title)
          if (source) {
            const full = await api.getGuide(source.id)
            if (full?.steps?.length) {
              resolved = full.steps.map((s, i) => ({ ...s, id: data?.[i]?.id ?? s.id }))
            }
          }
        } catch {
          // Session/guide lookup failing must not block resume.
        }
        setSteps(resolved)
        setStepIndex(Math.min(resumeIndex, Math.max(resolved.length - 1, 0)))
      } catch (err) {
        console.error('Failed to load steps:', err.message)
      } finally {
        setStepsLoading(false)
      }
    })()
  }, [sessionId, guide])

  // The three on-page effects below are keyed on the step OBJECT, not the
  // index: `steps` arrives asynchronously (mock, prop, or backend fetch), and
  // an index-only dependency left them dormant on a fresh start — mounted at
  // step 0, they bailed on the empty array and never re-ran when the steps
  // filled in, so nothing highlighted and no listeners attached until the
  // user changed steps by hand.
  useEffect(() => {
    if (!step) return
    let cancelled = false
    let retryTimer
    // A new step gets a clean slate: the previous step's escape hatch pointed at
    // a destination that means nothing here.
    setFallbackBoth(null)

    async function checkStep(attempt = 0) {
      if (hiddenRef.current) return

      // If the tab is already on the page this step leads to, the step is
      // done (or unnecessary) — skip ahead. This is what lets the search
      // lead-in steps disappear when the user is already on Cloud SQL. Only at
      // the frontier, though: a step the user pressed Back to re-do sits on a
      // stale URL from a later screen, and auto-skipping it would cascade them
      // straight back forward (see maxReachedRef).
      const tabInfo = await getCurrentGcpUrl()
      if (cancelled) return
      // Auto-advance when the tab is already on the page this step leads to —
      // at the frontier, OR (for `autoSkip` steps like step 4's "New instance")
      // once the tab has physically LEFT this step's own page, so a direct button
      // that lands you on the engine picker skips step 4 even after walking back.
      // On a fresh run this stays off until the tab navigates (freshRunRef):
      // the URL found at mount is leftover state, not this run's progress.
      if (
        !backPressedRef.current &&
        (!freshRunRef.current || navigatedSinceMountRef.current) &&
        tabInfo?.ok &&
        stepCompletedByUrl(step, tabInfo.url) &&
        (atFrontier() || (step.autoSkip && !isOnStepPage(step, tabInfo.url)))
      ) {
        autoAdvance()
        return
      }

      // Page-bound steps first: a step that declares a urlPattern lives on a
      // specific page. If the tab isn't on it (e.g. you pressed Back to step 3
      // while still on the create-instance page), DON'T scan the current page
      // for a same-named look-alike and highlight it — say so and offer "Take
      // me back", which loads the step's page. Page-agnostic steps (the search
      // lead-ins) have no urlPattern and fall through to the DOM-first path.
      if (step.urlPattern && tabInfo?.ok && !isOnStepPage(step, tabInfo.url)) {
        setOffTrack(true)
        setStatusMessage(OFF_TRACK_MESSAGE)
        showLostMascot()
        return
      }

      // DOM-first: for page-agnostic steps (and once we know we're on the right
      // page), try to find the element BEFORE judging further. The resolver
      // only accepts a confident match, so finding the target means we're good
      // even if the URL hasn't settled (a dropdown opened, SPA route updating).
      // applyHeal reuses any previously-healed intent for this step.
      const result = await highlightStep(applyHeal(step), mascotExtras)
      if (cancelled) return

      if (result?.ok) {
        setOffTrack(false)
        setStatusMessage('')
        return
      }

      // Element not found on a page-agnostic step too — surface "navigate there
      // manually" rather than highlighting whatever happens to share the name.
      if (result?.error === 'not-found' && tabInfo?.ok && !isOnStepPage(step, tabInfo.url)) {
        setOffTrack(true)
        setStatusMessage(OFF_TRACK_MESSAGE)
        showLostMascot()
        return
      }

      if (result?.error === 'not-found') {
        if (attempt < HIGHLIGHT_RETRIES) {
          retryTimer = setTimeout(() => checkStep(attempt + 1), HIGHLIGHT_RETRY_MS)
          return
        }
        // SELF-HEAL DISABLED — after retries are exhausted we no longer snapshot
        // the page and call the backend to repair the selector; we fall straight
        // through to the "navigate there manually" status below.
        // if (!healAttemptedRef.current[stepIndex]) {
        //   healAttemptedRef.current[stepIndex] = true
        //   setStatusMessage(HEALING_MESSAGE)
        //   const override = await tryRepair(step)
        //   if (cancelled) return
        //   if (override) {
        //     healedRef.current[stepIndex] = override
        //     const healedResult = await highlightStep(applyHeal(step), mascotExtras)
        //     if (cancelled) return
        //     if (healedResult?.ok) {
        //       setOffTrack(false)
        //       setStatusMessage('')
        //       return
        //     }
        //   }
        // }

        // Retries exhausted. A step that declares `fallbackUrl` knows where it
        // was leading, so offer to jump straight there rather than dead-ending
        // on "navigate there manually" — arriving satisfies the step's
        // advanceOnUrlPattern, which completes it. This deliberately doesn't
        // ask WHY the element was missing: the squeezed-console search collapse
        // is the common cause, but a redesign or a non-English console lands
        // here too, and the shortcut is just as good an answer.
        if (step.fallbackUrl) {
          setFallbackBoth({ url: step.fallbackUrl, hint: step.fallbackHint })
          setOffTrack(true)
          setStatusMessage(step.fallbackHint || STATUS_MESSAGES['not-found'])
          showLostMascot({
            title: 'Want a shortcut?',
            message: "I can't spot this one — click me and I'll take you straight there.",
            // We're on the right page and it's the ELEMENT that's missing, so he
            // puzzles over it rather than drooping as if we'd wandered off.
            mood: 'confused',
          })
          return
        }
      }

      setOffTrack(false)
      setStatusMessage(STATUS_MESSAGES[result?.error] ?? '')
    }

    checkStep()
    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Voice, split from the highlight effect and keyed on the spoken TEXT: the
  // steps array can be replaced by a content-equivalent copy mid-run (e.g.
  // adopting backend step ids), which must neither cut the announcement off
  // nor restart it. A real step change swaps the text and re-announces.
  const announcement = step ? `Step ${stepNumber}: ${step.title}. ${step.description}` : ''
  useEffect(() => {
    if (!announcement || !voiceEnabled) return
    speakText(announcement)
    return () => stopSpeaking()
  }, [announcement, voiceEnabled])

  useEffect(() => {
    // A fresh Guidance mount is a fresh run: drop any tab pinned by a previous
    // run/recording so this one adopts the Console tab the user is on now.
    // Mount-only on purpose — sessionId/guide change identity MID-run (the
    // backend id merge), and re-pinning then could grab whatever tab the user
    // happens to be reading at that moment.
    resetGuidedTab()
    return () => {
      clearGuideHighlight()
      clearTimeout(submitTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!step) return
    let timer
    const unsubscribe = onGcpUrlChanged((url) => {
      // A real navigation happened during THIS run — from here on the tab URL
      // is trustworthy, so mount-suppressed catch-up (fresh runs) re-arms.
      navigatedSinceMountRef.current = true
      // Auto-advance on navigation only at the frontier — while re-doing earlier
      // steps the user walked back to, a navigation that satisfies a later step
      // must not yank them forward past the steps they're deliberately redoing.
      if (
        !backPressedRef.current &&
        stepCompletedByUrl(step, url) &&
        (atFrontier() || (step.autoSkip && !isOnStepPage(step, url)))
      ) {
        autoAdvance()
        return
      }
      if (hiddenRef.current) return
      clearTimeout(timer)
      // Off-track is decided by the URL alone — show "Take me back" IMMEDIATELY,
      // without the 1.2s wait and without scanning the wrong page (which on e.g.
      // the MySQL form grabs a stray "PostgreSQL" mention and flashes a wrong
      // highlight box before falling back to Take me back).
      if (step.urlPattern && !isOnStepPage(step, url)) {
        setOffTrack(true)
        setStatusMessage(OFF_TRACK_MESSAGE)
        showLostMascot()
        return
      }
      timer = setTimeout(async () => {
        const result = await highlightStep(applyHeal(step), mascotExtras)
        if (result?.ok) {
          setOffTrack(false)
          setStatusMessage('')
          return
        }
        const tabInfo = await getCurrentGcpUrl()
        if (result?.error === 'not-found' && tabInfo?.ok && !isOnStepPage(step, tabInfo.url)) {
          setOffTrack(true)
          setStatusMessage(OFF_TRACK_MESSAGE)
          showLostMascot()
        }
      }, 1200)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const handleShowMe = async () => {
    hiddenRef.current = false
    // Page-bound step but we're not on its page: offer "Take me back" instead
    // of highlighting a same-named look-alike on whatever page we're on.
    const tabInfo = await getCurrentGcpUrl()
    if (step.urlPattern && tabInfo?.ok && !isOnStepPage(step, tabInfo.url)) {
      setOffTrack(true)
      setStatusMessage(OFF_TRACK_MESSAGE)
      showLostMascot()
      return
    }
    const result = await highlightStep(applyHeal(step), mascotExtras)
    if (result?.ok) {
      setOffTrack(false)
      setStatusMessage('')
      return
    }
    // We're on the right page (or the step is page-agnostic) but the element
    // isn't there — report it rather than highlighting a look-alike.
    setOffTrack(false)
    setStatusMessage(STATUS_MESSAGES[result?.error] ?? '')
  }

  const handleTakeMeBack = async () => {
    hiddenRef.current = false
    // The escape hatch goes FORWARD to the step's destination, not back to the
    // page the step lives on — and it's an explicit forward move, so it clears
    // the Back guard that would otherwise suppress the auto-advance on arrival.
    // Read via the ref: the mascot's copy of this handler predates the fallback.
    const fb = fallbackRef.current
    if (fb) {
      backPressedRef.current = false
      const jumped = await goToUrl(fb.url)
      if (!jumped?.ok) {
        setStatusMessage(STATUS_MESSAGES[jumped?.error] ?? OFF_TRACK_MESSAGE)
        return
      }
      setOffTrack(false)
      setStatusMessage('')
      return
    }
    const result = await goToStepPage(step)
    if (!result?.ok) {
      setStatusMessage(STATUS_MESSAGES[result?.error] ?? OFF_TRACK_MESSAGE)
      return
    }
    setOffTrack(false)
    setStatusMessage('')
    setTimeout(() => {
      highlightStep(applyHeal(step), mascotExtras).then((res) => {
        setStatusMessage(res?.ok ? '' : (STATUS_MESSAGES[res?.error] ?? ''))
      })
    }, 1500)
  }

  // "Open the Cloud Console": connect the guide to a Console tab (focus an
  // existing one — reloading it only if its content script is dead — or open a
  // fresh tab, landed on this step's page when it has one), then keep retrying
  // the highlight while the console loads. The pinned-tab URL listener usually
  // wins the race for a fresh tab; this loop covers reloaded/parked tabs, and
  // stops the moment the user moves to another step.
  const handleOpenConsole = async () => {
    hiddenRef.current = false
    setOpeningConsole(true)
    const pressedIndex = stepIndex
    const res = await openGcpConsole(step?.url)
    if (!res?.ok) {
      setOpeningConsole(false)
      setStatusMessage(STATUS_MESSAGES['no-gcp-tab'])
      return
    }
    for (let attempt = 0; attempt < CONSOLE_OPEN_RETRIES; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, CONSOLE_OPEN_RETRY_MS))
      if (stepIndexRef.current !== pressedIndex) break // guide moved on
      const result = await highlightStep(applyHeal(step), mascotExtras)
      if (result?.ok) {
        setOffTrack(false)
        setStatusMessage('')
        break
      }
      // Connected, but the tab is parked on a different page than this step's
      // (e.g. an existing tab we focused) — hand over to the normal off-track
      // flow; its "Take me back" navigates to the step's page.
      const tabInfo = await getCurrentGcpUrl()
      if (step.urlPattern && tabInfo?.ok && !isOnStepPage(step, tabInfo.url)) {
        setOffTrack(true)
        setStatusMessage(OFF_TRACK_MESSAGE)
        showLostMascot()
        break
      }
      if (attempt === CONSOLE_OPEN_RETRIES - 1) {
        setStatusMessage(STATUS_MESSAGES[result?.error] ?? STATUS_MESSAGES['not-found'])
      }
    }
    setOpeningConsole(false)
  }

  useEffect(() => {
    if (!step) return
    return onGuideStepEvent({
      onClicked: (selector) => {
        // The content script reports progress under `selector || name`, so a
        // generalized step (whose instance-specific selector was dropped) is
        // keyed by its name. Compare against the same fallback.
        const stepKey = step.selector || step.name
        if (selector !== stepKey) return
        // Only a "click" step completes when its target is clicked. On a
        // "highlight" step (e.g. the Region dropdown) the click just opens the
        // control — the user still has to pick a value — so it must NOT advance.
        // EXCEPTION: the FINAL step. Cloud Run's "Watch it go live" is a
        // highlight step on the service URL with no other advance path — the
        // link opens the app in a NEW tab, so the guided tab never navigates,
        // and without this the guide could never reach the celebration screen.
        // Completing the last step on the user's own click is safe: nothing
        // follows it.
        if (step.action !== 'click' && !isLastStep) return
        // A submit step (Create instance) is special: the click might be
        // rejected by validation. Don't complete on the click — verify that the
        // page actually moved on; if not, prompt the user to fix the errors.
        if (step.awaitNavigation) verifySubmit()
        else autoAdvance()
      },
      onFilled: (selector) => {
        // A fill event fires only when the user committed a value — typed into
        // an input (incl. the Password highlight step) or picked a dropdown
        // option (the region <mat-select>). That always completes the step,
        // whatever its action, so don't gate this on step.action. Keyed by
        // `selector || name` to match generalized steps (see onClicked).
        if (selector === (step.selector || step.name)) autoAdvance()
      },
      onDismissed: () => {
        hiddenRef.current = true
        setStatusMessage(HIDDEN_MESSAGE)
      },
      onGoBack: () => handleTakeMeBack(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const handleDoItForMe = async () => {
    setAutomating(true)
    const result = await runStepAction(applyHeal(step))
    setAutomating(false)
    if (!result?.ok) {
      setStatusMessage(STATUS_MESSAGES[result?.error] ?? '')
      return
    }
    // A submit step only "completes" if the create actually went through —
    // verify the navigation instead of blindly advancing (same as a manual click).
    if (step.awaitNavigation) verifySubmit()
    else {
      // The URL listener may advance first (a navigating click), which resets
      // advancedRef on arrival at the new step — so that guard alone can't stop
      // this timer from advancing a SECOND time. Only fire if the guide is
      // still on the step the button was pressed on.
      const pressedIndex = stepIndex
      setTimeout(() => {
        if (stepIndexRef.current === pressedIndex) autoAdvance()
      }, 800)
    }
  }

  const toggleVoice = () => {
    setVoiceEnabled((v) => {
      if (v) stopSpeaking()
      return !v
    })
  }

  const handleCycleVoiceRate = () => setVoiceRate(cycleSpeechRate())

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsgId = crypto.randomUUID()
    const replyMsgId = crypto.randomUUID()

    // Build conversation history from previous messages (cap at 20)
    const chatHistory = messages
      .filter((m) => m.type !== 'typing' && (m.variant === 'user' || m.variant === 'ai'))
      .slice(-20)
      .map((m) => ({
        role: m.variant === 'user' ? 'user' : 'assistant',
        content: m.message,
      }))

    // Sent separately from the message (never concatenated into it) — the
    // backend only shows this to the text-reply model, never to the
    // action-word check or the RAG guide search, so a step's own instructions
    // ("Click Create to deploy...") can't make an unrelated "hey" look like a
    // deployment request and hijack the reply into a guide_match card.
    const stepContext = step
      ? `Current step ${stepNumber}/${steps.length}: ${step.title} — ${step.description}`
      : null

    setMessages((m) => [
      ...m,
      { id: userMsgId, variant: 'user', message: text, timestamp: new Date().toISOString() },
    ])
    setInput('')
    setSending(true)

    setMessages((m) => [
      ...m,
      {
        id: replyMsgId,
        type: 'typing',
        variant: 'ai',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      // Page summary + screenshot when page-sharing is on; failure-tolerant so a
      // missing Console tab or rate-limited capture just sends page-blind.
      const page = pageShare ? await captureChatPage() : null

      // Second arg: streaming callback — repaint the reply bubble with the
      // accumulated text as tokens arrive.
      const response = await api.sendChat(
        text,
        (partial) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.id === replyMsgId ? { ...msg, type: undefined, message: partial } : msg,
            ),
          ),
        chatHistory,
        stepContext,
        page,
      )
      setMessages((m) =>
        m.map((msg) =>
          msg.id === replyMsgId
            ? {
                ...msg,
                type: undefined,
                message:
                  response.type === 'blueprint_json' || response.type === 'guide_match'
                    ? `📋 ${response.data.title} — ${response.data.steps?.length ?? 0} step(s) ready!`
                    : response.data,
                ...(response.type === 'blueprint_json' || response.type === 'guide_match'
                  ? { onAction: () => {}, actionLabel: undefined }
                  : {}),
              }
            : msg,
        ),
      )
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === replyMsgId
            ? { ...msg, type: undefined, message: `⚠️ ${err.message || 'Could not reach Baymax.'}` }
            : msg,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  if (completed) {
    return (
      <GuidanceComplete
        guideTitle={currentGuide?.title ?? guide?.title ?? CLOUD_SQL_POSTGRES_GUIDE.title}
        totalSteps={steps.length}
        nextSteps={currentGuide?.nextSteps}
        onNewTask={onNewTask}
        onDone={onComplete}
        onBackToEditing={onBackToRecorder}
        success={runSuccess}
      />
    )
  }

  if (stepsLoading) {
    return (
      <div className="flex h-full flex-col" data-session-id={sessionId ?? undefined}>
        <div className="flex min-h-0 flex-1 flex-col p-7.5 pb-0">
          <TaskStepCardPlaceholder message="Loading steps..." loadingIcon />
          <ChatThread messages={messages} />
        </div>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          placeholder="Ask a follow-up..."
        />
      </div>
    )
  }

  if (!stepsLoading && steps.length === 0) {
    return (
      <div className="flex h-full flex-col" data-session-id={sessionId ?? undefined}>
        <div className="flex min-h-0 flex-1 flex-col p-7.5 pb-0">
          <TaskStepCardPlaceholder message="No steps found." />
          <ChatThread messages={messages} />
        </div>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={send}
          placeholder="Ask a follow-up..."
        />
      </div>
    )
  }

  // The guide has no Console tab it can reach (none open, or the tab predates
  // the extension load so its content script is gone) — both are fixed by the
  // "Open the Cloud Console" banner below, so the card's red status line
  // hands the message over to it.
  const needsConsole =
    statusMessage === STATUS_MESSAGES['no-gcp-tab'] ||
    statusMessage === STATUS_MESSAGES['no-content-script']

  return (
    <div className="flex h-full flex-col" data-session-id={sessionId ?? undefined}>
      <div className="flex min-h-0 flex-1 flex-col p-7.5 pb-0">
        <div className="z-10 -mb-2 shrink-0">
          {/* Trial of a recorded draft — one tap back to the Recorder (the
              draft is still there) the moment a step doesn't behave. */}
          {onBackToRecorder && (
            <div className="bg-accent mb-2 flex items-center justify-between gap-2 rounded px-3 py-2">
              <span className="text-caption text-accent-foreground">
                Test-driving your recording
              </span>
              <button
                type="button"
                onClick={onBackToRecorder}
                className="text-caption text-primary flex shrink-0 items-center gap-1 font-medium hover:underline"
              >
                <PencilLine size={13} /> Back to editing
              </button>
            </div>
          )}
          <TaskStepCard
            stepNumber={stepNumber}
            totalSteps={steps.length}
            title={step.title}
            description={step.description}
            canAutomate={step.action === 'click' || step.action === 'fill'}
            automating={automating}
            onShowMe={handleShowMe}
            onDoItForMe={handleDoItForMe}
            voiceEnabled={voiceEnabled}
            onToggleVoice={isSpeechSynthesisSupported() ? toggleVoice : undefined}
            onThumbsDown={handleThumbsDown}
            feedbackSubmitted={failedSteps.has(stepNumber)}
            feedbackSubmitting={feedbackSubmitting}
            voiceRate={voiceRate}
            onCycleVoiceRate={isSpeechSynthesisSupported() ? handleCycleVoiceRate : undefined}
            statusMessage={needsConsole || openingConsole ? '' : statusMessage}
            offTrack={offTrack}
            onTakeMeBack={handleTakeMeBack}
            // Manual Back/Next is a review tool for recording trial runs only
            // (onBackToRecorder is set ⇔ "Test-driving your recording"). Real
            // guided runs stay single-flow: steps advance on the user's own
            // click/fill or URL change, so the buttons don't render at all.
            onPrev={onBackToRecorder ? goPrev : undefined}
            onNext={onBackToRecorder ? goNext : undefined}
            isFirstStep={stepIndex === 0}
            isLastStep={isLastStep}
          />
          {(needsConsole || openingConsole) && (
            <div className="bg-info-soft mt-2 rounded px-3 py-2">
              <div className="flex items-start gap-2">
                <ExternalLink size={14} className="text-info mt-0.5 flex-shrink-0" />
                <span className="text-caption text-info-foreground">
                  {openingConsole
                    ? 'Opening the Cloud Console — Baymax will highlight the step once it loads…'
                    : 'Baymax needs a Cloud Console tab in this window to guide you.'}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={openingConsole}
                onClick={handleOpenConsole}
              >
                <ExternalLink size={14} />
                {openingConsole ? 'Opening…' : 'Open the Cloud Console'}
              </Button>
            </div>
          )}
        </div>
        <ChatThread messages={messages} />
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={send}
        placeholder={sending ? 'Baymax is thinking...' : 'Ask a follow-up...'}
      />
    </div>
  )
}
