// Drives a guide-recording session for the Recorder screen.
//
// The capture plumbing already exists end-to-end: the content script
// (public/guide-overlay.js) watches the GCP tab and streams each click/typing
// as a BAYMAX_RECORD_ACTION; src/lib/guide.js bridges it. This hook owns the
// React side — it turns that stream into an editable list of draft steps (in the
// same intent shape the guide engine runs) and exposes edit operations for the
// review screen.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  startRecording,
  stopRecording,
  onRecordedAction,
  recordedActionToStep,
  captureGuidedTabScreenshot,
} from '@/lib/guide'

// Two draft steps point at the same element when their accessible name or their
// structural selector matches. Used to collapse "click a field then type into
// it" into a single fill step, and to drop an exact repeat.
function sameTarget(a, b) {
  if (a.name && b.name && a.name === b.name) return true
  if (a.selector && b.selector && a.selector === b.selector) return true
  return false
}

export function useRecorder(initialSteps = []) {
  const [recording, setRecording] = useState(false)
  const [steps, setSteps] = useState(initialSteps)
  // Set when recording can't start (e.g. the active tab isn't the GCP console).
  const [error, setError] = useState('')
  const unsubRef = useRef(null)
  // Screenshot captures are async, so they run through a promise CHAIN — each
  // recorded action appends its step only after the previous one did, keeping
  // the step list in arrival order even when captures resolve out of order.
  const captureChainRef = useRef(Promise.resolve())

  const start = useCallback(async () => {
    setError('')
    setSteps([])
    const res = await startRecording()
    if (!res?.ok) {
      setError(res?.error || 'cant-record')
      return
    }
    setRecording(true)
    unsubRef.current = onRecordedAction((action) => {
      captureChainRef.current = captureChainRef.current.then(async () => {
        // One picture per action, taken the moment it arrives. Null just means
        // this step exports text-only (rate limit / no permission) — the
        // screenshot lives ONLY on the draft in memory: buildGuide()'s field
        // whitelist keeps it out of saves, downloads and the refine call.
        const screenshot = await captureGuidedTabScreenshot()
        setSteps((prev) => {
          const next = recordedActionToStep(action, prev.length)
          // Keep the value the user actually typed so the review screen can show
          // it; recordedActionToStep blanks it (for sharing) — we re-attach it and
          // rely on the per-step "parameter" toggle to decide what gets exported.
          if (action.recordAction === 'fill') next.value = action.value || ''
          if (screenshot) {
            next.screenshot = screenshot
            // Where the clicked/typed element sat in the tab viewport at record
            // time — the PDF export draws its marker box from this.
            if (action.rect) next.screenshotRect = action.rect
          }

          const last = prev[prev.length - 1]
          // Clicking a field to focus it, then typing, arrives as click+fill on the
          // same target — collapse into one fill step. The click's screenshot shows
          // the field before typing, so it wins over the mid-typing one (and its
          // marker rect travels with whichever screenshot won).
          if (last && next.action === 'fill' && last.action !== 'fill' && sameTarget(last, next)) {
            return [
              ...prev.slice(0, -1),
              {
                ...next,
                id: last.id,
                screenshot: last.screenshot || next.screenshot,
                screenshotRect: last.screenshot ? last.screenshotRect : next.screenshotRect,
              },
            ]
          }
          // Ignore an exact repeat of the previous action on the same target.
          if (last && last.action === next.action && sameTarget(last, next)) return prev
          return [...prev, next]
        })
      })
    })
  }, [])

  const stop = useCallback(() => {
    setRecording(false)
    stopRecording()
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
  }, [])

  const update = useCallback((index, patch) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }, [])

  const remove = useCallback((index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Swap in a whole new draft list at once — used by the AI-refine pass to
  // apply the polished titles/descriptions after recording stops. Accepts an
  // array or an updater fn of the current drafts (like setState).
  const replace = useCallback((next) => {
    setSteps((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      return Array.isArray(value) ? value : []
    })
  }, [])

  const move = useCallback((index, dir) => {
    setSteps((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const copy = prev.slice()
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
  }, [])

  const reset = useCallback(() => {
    setSteps([])
    setError('')
  }, [])

  // Stop capturing if the screen unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current()
      stopRecording()
    }
  }, [])

  return { recording, steps, error, start, stop, update, remove, move, replace, reset }
}
