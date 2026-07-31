// Record-a-guide screen.
//
// The user records themselves doing a flow once on the GCP console; Baymax
// captures each click/field entry (via useRecorder, backed by the content
// script) into draft steps, which the user reviews/edits and then exports as
// JSON or runs live through the guide engine.
//
// Four states, derived from the hook:
//   idle      — nothing recorded yet → big Record button
//   recording — capturing live → red indicator + streaming step list + Stop
//   refining  — stopped; Baymax is polishing the wording against the GCP docs
//   review    — editable list + Download / Try it now

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Input, Switch } from '@/components/ui'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  FileText,
  FolderOpen,
  Keyboard,
  Loader2,
  MousePointerClick,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRecorder } from '@/lib/useRecorder'
import { applyGeneric, portableConsoleUrl, urlPatternFromUrl } from '@/lib/guide'
import { exportGuidePdf } from '@/lib/pdfExport'
import { api } from '@/lib/api'

const START_ERRORS = {
  'no-gcp-tab': 'Open console.cloud.google.com in this window, then start recording.',
  'no-content-script': "Couldn't reach the Cloud Console tab — reload it and try again.",
  'cant-record': "Couldn't start recording. Make sure the Cloud Console tab is open.",
}

// Untouched default guide name — the AI-proposed title only replaces this, so
// a name the user typed themselves is never overwritten.
const DEFAULT_TITLE = 'My recorded guide'

// ── Local screenshot store ──────────────────────────────────────────────────
// Step screenshots are deliberately kept OUT of the saved guide (buildGuide's
// field whitelist) so the backend copy stays lean — chat search and AI-refine
// payloads read it. To survive Save → Open → Export PDF they're stashed in
// chrome.storage.local keyed by the saved guide's id. This machine/profile
// only: a guide opened on another laptop exports text-only, by design.
const shotsKey = (id) => `baymax-shots:${id}`
const shotsStoreAvailable = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

async function saveShotsLocal(guideId, steps) {
  if (!shotsStoreAvailable() || !guideId) return
  const shots = steps.map((s) =>
    s.screenshot ? { shot: s.screenshot, rect: s.screenshotRect || null } : null,
  )
  if (!shots.some(Boolean)) return
  try {
    await chrome.storage.local.set({ [shotsKey(guideId)]: shots })
  } catch {
    /* storage full — the guide is saved fine, its PDF just loses images */
  }
}

async function loadShotsLocal(guideId) {
  if (!shotsStoreAvailable() || !guideId) return null
  try {
    const data = await chrome.storage.local.get(shotsKey(guideId))
    return data?.[shotsKey(guideId)] ?? null
  } catch {
    return null
  }
}

function removeShotsLocal(guideId) {
  if (!shotsStoreAvailable() || !guideId) return
  chrome.storage.local.remove(shotsKey(guideId)).catch(() => {})
}

// Assemble the editable drafts into a guide object the engine can run. When
// `forExport` is true, parameter fields are blanked so secrets (passwords, ids)
// aren't baked into a shared/downloaded guide; for a live run we keep them.
// applyGeneric rewrites any step the user left "Match any instance" on so it
// targets the control by role + a resource-agnostic name (dropping the recorded
// project/instance id), and strips the internal generalization flags.
function buildGuide(title, steps, forExport) {
  return {
    id: `recorded-${
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') || 'guide'
    }`,
    title: title.trim() || 'Recorded guide',
    steps: steps.map((s, i) => {
      const step = applyGeneric({
        id: i + 1,
        title: s.title,
        description: s.description,
        action: s.action,
        role: s.role || undefined,
        name: s.name || undefined,
        text: s.text || undefined,
        href: s.href || undefined,
        selector: s.selector || undefined,
        value: s.action === 'fill' ? (forExport && s.isParameter ? '' : s.value || '') : undefined,
        isParameter: s.isParameter || undefined,
        url: s.url || undefined,
        // Page-binding for off-track detection + "Take me back". Captured at
        // record time (volatile ids already wildcarded); derived here for
        // imported steps that predate the field. Without it a recorded guide
        // replays with no idea whether the user is on the right page.
        urlPattern: s.urlPattern || (s.url ? urlPatternFromUrl(s.url) : undefined),
        generic: s.generic || undefined,
        instanceSpecific: s.instanceSpecific || undefined,
      })
      // A shared copy must not be pinned to the recorder's own account: strip
      // the ?project=/?organizationId= query from the navigation URL (the
      // console re-adds the viewer's own project) and from the href hint (so
      // it matches everyone's links, not just the recorder's). Done AFTER
      // applyGeneric, which needs the original URL's tokens to generalize
      // instance-specific names.
      if (forExport) {
        if (step.url) step.url = portableConsoleUrl(step.url)
        if (step.href) step.href = portableConsoleUrl(step.href)
      }
      return step
    }),
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function ActionTag({ action }) {
  const fill = action === 'fill'
  return (
    <span className="bg-accent text-caption text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
      {fill ? <Keyboard size={12} /> : <MousePointerClick size={12} />}
      {fill ? 'Type' : 'Click'}
    </span>
  )
}

// One draft step in the review list — title/description editable, plus the
// value + parameter toggle for fill steps, and reorder/delete controls.
function StepRow({ index, total, step, onUpdate, onMove, onRemove }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <span className="bg-primary text-caption text-primary-foreground mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-semibold">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <ActionTag action={step.action} />
            <span className="text-caption text-muted-foreground truncate">
              {step.name || step.text || step.selector || 'element'}
            </span>
          </div>
          <Input
            value={step.title}
            onChange={(e) => onUpdate(index, { title: e.target.value })}
            placeholder="Step title"
          />
          <textarea
            value={step.description}
            onChange={(e) => onUpdate(index, { description: e.target.value })}
            placeholder="What should the user do here?"
            rows={2}
            className="border-input text-small focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 outline-none focus-visible:ring-3"
          />
          {step.action === 'fill' && (
            <div className="border-border space-y-2 rounded-lg border border-dashed p-2">
              <Input
                value={step.value || ''}
                onChange={(e) => onUpdate(index, { value: e.target.value })}
                placeholder="Example value"
              />
              <label className="text-caption text-muted-foreground flex items-center justify-between">
                <span>Treat as parameter (don&apos;t save the value)</span>
                <Switch
                  checked={!!step.isParameter}
                  onCheckedChange={(v) => onUpdate(index, { isParameter: v })}
                />
              </label>
            </div>
          )}
          {/* This element's recorded name carries a specific project/instance id
              (e.g. "View more actions for my-instance"). Leaving this on lets the
              guide point at the same control on ANY project/instance; turn it off
              to match only the exact resource recorded. */}
          {step.instanceSpecific && (
            <label className="border-border text-caption text-muted-foreground flex items-center justify-between gap-2 rounded-lg border border-dashed p-2">
              <span>Match any instance (ignore the specific name/ID)</span>
              <Switch
                checked={step.generic !== false}
                onCheckedChange={(v) => onUpdate(index, { generic: v })}
              />
            </label>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label="Move up"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label="Delete step"
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

export default function Recorder({
  onTryGuide,
  initialSteps = [],
  // App.jsx keeps the Recorder MOUNTED (hidden) while other tabs are shown so
  // the draft survives "Try it now" round-trips; `active` is false then.
  active = true,
  // When the dashboard sends LOAD_RECORDING, this holds the guide id to load.
  loadGuideId = null,
  onGuideLoaded,
}) {
  const { recording, steps, error, start, stop, update, remove, move, replace, reset } =
    useRecorder(initialSteps)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  // Save-to-backend state for the "Save guide" button.
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState('')
  // Signature of the guide at its last successful save. Comparing it to the live
  // guide (derived in render, no effect) tells us whether the saved copy is
  // stale — any edit flips the button back to "Save guide".
  const [savedSig, setSavedSig] = useState(null)
  // AI-refinement pass (runs automatically after Stop, retryable from review).
  const [refining, setRefining] = useState(false)
  const [refineNote, setRefineNote] = useState(null) // null | { ok, summary? }
  // Bumped to invalidate an in-flight refine (Skip / Discard) so a late
  // response can't clobber whatever the user is doing by then.
  const refineRun = useRef(0)
  // "My recordings" (saved guides, fetched on open) + JSON import — both
  // entered from the idle screen.
  const [showLibrary, setShowLibrary] = useState(false)
  const [libGuides, setLibGuides] = useState([])
  const [libLoading, setLibLoading] = useState(false)
  const [libError, setLibError] = useState('')
  const [libBusyId, setLibBusyId] = useState(null)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  // Hidden screens must not keep CAPTURING: leaving the Record tab mid-recording
  // stops the capture (clicks made elsewhere — e.g. during a trial run — must
  // not become steps) but KEEPS the steps recorded so far as the draft. No
  // auto-refine here: the review screen offers "Refine with AI" instead, so a
  // background API call can't surprise the user.
  useEffect(() => {
    if (!active && recording) stop()
  }, [active, recording, stop])

  const mode = recording ? 'recording' : refining ? 'refining' : steps.length ? 'review' : 'idle'
  const guideSig = JSON.stringify({ title, steps })
  const isSaved = saveState === 'saved' && savedSig === guideSig

  const handleDownload = () =>
    downloadJson(`${title || 'guide'}.json`, buildGuide(title, steps, true))
  const handleTry = () => onTryGuide?.(buildGuide(title, steps, false))

  // Shareable step-by-step document: instruction text + the screenshot captured
  // for each recorded action. Built from the raw drafts (screenshots live only
  // there); typed parameter values stay out, same rule as the JSON export.
  const [exportingPdf, setExportingPdf] = useState(false)
  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportGuidePdf(title, steps)
    } catch (e) {
      console.error('PDF export failed:', e.message)
    } finally {
      setExportingPdf(false)
    }
  }

  // Send the recording to the backend, where Gemini cross-checks it against
  // the official Google Cloud docs and rewrites ONLY the step wording (the
  // recorded actions/metadata are preserved server-side). We send the export
  // shape — parameter values blanked, so secrets never leave the panel — and
  // merge the polished title/description back into the drafts by position.
  // Any failure just drops the user on the raw recording, never blocks them.
  const refine = async (drafts) => {
    const run = ++refineRun.current
    setRefining(true)
    setRefineNote(null)
    try {
      const res = await api.refineGuide(buildGuide(title, drafts, true), AbortSignal.timeout(90000))
      if (run !== refineRun.current) return // skipped/discarded — drop late result
      if (res?.ok && Array.isArray(res.steps) && res.steps.length) {
        replace((current) =>
          current.map((s, i) => ({
            ...s,
            title: res.steps[i]?.title || s.title,
            description: res.steps[i]?.description || s.description,
          })),
        )
        if (res.title && title === DEFAULT_TITLE) setTitle(res.title)
        setRefineNote({ ok: true, summary: res.summary || '' })
      } else {
        setRefineNote({ ok: false })
      }
    } catch {
      if (run === refineRun.current) setRefineNote({ ok: false })
    } finally {
      if (run === refineRun.current) setRefining(false)
    }
  }

  const handleStop = () => {
    stop()
    if (steps.length) refine(steps)
  }

  const skipRefine = () => {
    refineRun.current++ // ignore the in-flight response
    setRefining(false)
    setRefineNote(null)
  }

  const handleDiscard = () => {
    refineRun.current++
    setRefining(false)
    setRefineNote(null)
    setTitle(DEFAULT_TITLE)
    setSaveState('idle')
    setSavedSig(null)
    reset()
  }

  // Persist the guide to the backend. forExport=true blanks values flagged as
  // parameters, so secrets toggled "don't save the value" aren't stored. Needs a
  // signed-in session (the API client attaches the token); otherwise it 401s.
  const handleSave = async () => {
    setSaveState('saving')
    setSaveError('')
    try {
      const saved = await api.saveGuide(buildGuide(title, steps, true))
      // Keep this draft's screenshots retrievable for the saved copy (local
      // stash — see the Local screenshot store note above).
      await saveShotsLocal(saved?.id, steps)
      setSavedSig(JSON.stringify({ title, steps }))
      setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      setSaveError(e.message || 'Could not save the guide.')
    }
  }

  // Swap a draft in from an outside source (a saved guide or an imported
  // JSON) and reset the per-draft flags so the review screen treats it like a
  // fresh recording — from there the normal edit/try/save loop applies.
  const loadDraft = useCallback(
    (guideTitle, draftSteps) => {
      setTitle(
        typeof guideTitle === 'string' && guideTitle.trim() ? guideTitle.trim() : DEFAULT_TITLE,
      )
      replace(draftSteps.map((s, i) => ({ ...s, id: i + 1 })))
      setRefineNote(null)
      setSaveState('idle')
      setShowLibrary(false)
      setImportError('')
    },
    [replace],
  )

  // When the dashboard sends a guide to load (LOAD_RECORDING), fetch it and
  // open it in the editor. We still rely on api.getGuide's own-or-official
  // access rule, which admins satisfy for any guide.
  useEffect(() => {
    if (!loadGuideId) return
    let cancelled = false
    ;(async () => {
      setLibBusyId(loadGuideId)
      try {
        const g = await api.getGuide(loadGuideId)
        if (cancelled) return
        const steps = Array.isArray(g.steps) ? g.steps : []
        const shots = await loadShotsLocal(loadGuideId)
        const merged = shots
          ? steps.map((s, i) =>
              shots[i]?.shot
                ? { ...s, screenshot: shots[i].shot, screenshotRect: shots[i].rect || undefined }
                : s,
            )
          : steps
        loadDraft(g.title, merged)
      } catch (e) {
        if (cancelled) return
        setLibError(e.message || 'Could not load that recording.')
      } finally {
        if (!cancelled) {
          setLibBusyId(null)
          onGuideLoaded?.()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadGuideId, onGuideLoaded, loadDraft])

  const openLibrary = async () => {
    setShowLibrary(true)
    setLibLoading(true)
    setLibError('')
    try {
      const all = await api.listGuides()
      // Own recordings only — the Baymax-curated official guides live on Home.
      setLibGuides(all.filter((g) => !g.is_official))
    } catch (e) {
      setLibError(e.message || 'Could not load your recordings.')
    } finally {
      setLibLoading(false)
    }
  }

  const loadSaved = async (id) => {
    setLibBusyId(id)
    setLibError('')
    try {
      const g = await api.getGuide(id)
      const steps = Array.isArray(g.steps) ? g.steps : []
      // Re-attach this guide's locally stashed screenshots (by position) so
      // Export PDF works on a reopened recording, not just a fresh one.
      const shots = await loadShotsLocal(id)
      const merged = shots
        ? steps.map((s, i) =>
            shots[i]?.shot
              ? { ...s, screenshot: shots[i].shot, screenshotRect: shots[i].rect || undefined }
              : s,
          )
        : steps
      loadDraft(g.title, merged)
    } catch (e) {
      setLibError(e.message || 'Could not load that recording.')
    } finally {
      setLibBusyId(null)
    }
  }

  const deleteSaved = async (id) => {
    if (!window.confirm('Delete this recording? This cannot be undone.')) return
    setLibBusyId(id)
    setLibError('')
    try {
      await api.deleteGuide(id)
      removeShotsLocal(id) // drop its stashed screenshots too
      setLibGuides((prev) => prev.filter((g) => g.id !== id))
    } catch (e) {
      setLibError(e.message || 'Could not delete that recording.')
    } finally {
      setLibBusyId(null)
    }
  }

  // Import a "Download JSON" export as the draft — how a guide recorded by one
  // Baymax user gets replayed (and edited/saved) on another's.
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again re-fires onChange
    if (!file) return
    setImportError('')
    try {
      const g = JSON.parse(await file.text())
      const stepsOk =
        g &&
        typeof g === 'object' &&
        Array.isArray(g.steps) &&
        g.steps.length &&
        g.steps.every((s) => s && typeof s === 'object' && (s.action || s.title || s.name))
      if (!stepsOk) throw new Error('not a guide')
      loadDraft(g.title, g.steps)
    } catch {
      setImportError(
        'That doesn\'t look like a Baymax guide JSON — export one with "Download JSON".',
      )
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {mode === 'idle' && !showLibrary && (
          <div className="flex flex-col items-center pt-10 text-center">
            <span className="bg-danger-soft flex h-16 w-16 items-center justify-center rounded-full">
              <Circle size={28} className="fill-danger text-danger" />
            </span>
            <h1 className="text-display mt-4">Record a guide</h1>
            <p className="text-body text-muted-foreground mt-2 max-w-xs">
              Do a flow once on the Cloud Console. Baymax captures every click and field you fill,
              then turns it into a step-by-step guide you can replay or share.
            </p>
            <Button className="mt-6" onClick={start}>
              <Circle size={14} className="fill-current" /> Start recording
            </Button>
            {error && (
              <p className="text-caption text-danger mt-3 flex items-center gap-1.5">
                <AlertCircle size={14} /> {START_ERRORS[error] ?? START_ERRORS['cant-record']}
              </p>
            )}

            {/* Existing recordings: browse the ones saved to the backend, or
                import a "Download JSON" export from another Baymax user. */}
            <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
              <Button variant="outline" onClick={openLibrary}>
                <FolderOpen size={15} /> My recordings
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} /> Import a guide (JSON)
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportFile}
              />
              {importError && (
                <p className="text-caption text-danger flex items-start gap-1.5 text-left">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {importError}
                </p>
              )}
            </div>
          </div>
        )}

        {mode === 'idle' && showLibrary && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLibrary(false)}
                aria-label="Back to the recorder"
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-h2">My recordings</h1>
            </div>
            {libError && (
              <p className="text-caption text-danger flex items-center gap-1.5">
                <AlertCircle size={14} /> {libError}
              </p>
            )}
            {libLoading ? (
              <p className="text-small text-muted-foreground flex items-center justify-center gap-2 py-10">
                <Loader2 size={15} className="animate-spin" /> Loading your recordings…
              </p>
            ) : libGuides.length === 0 && !libError ? (
              <p className="text-small text-muted-foreground py-10 text-center">
                No saved recordings yet — record a flow and hit &quot;Save guide&quot;.
              </p>
            ) : (
              <div className="space-y-2">
                {libGuides.map((g) => (
                  <Card key={g.id} className="p-4">
                    <p className="text-body text-foreground font-medium">{g.title}</p>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      {g.step_count} {g.step_count === 1 ? 'step' : 'steps'} · saved{' '}
                      {new Date(g.updated_at || g.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={libBusyId === g.id}
                        onClick={() => loadSaved(g.id)}
                      >
                        <FolderOpen size={14} />
                        {libBusyId === g.id ? 'Loading…' : 'Load & edit'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={libBusyId === g.id}
                        onClick={() => deleteSaved(g.id)}
                      >
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'recording' && (
          <div className="flex flex-col gap-3">
            <div className="border-danger/40 bg-danger-soft flex items-center justify-between rounded-lg border px-3 py-2">
              <span className="text-body text-danger flex items-center gap-2 font-medium">
                <Circle size={12} className="fill-danger text-danger animate-pulse" />
                Recording — {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </span>
              <Button variant="secondary" size="sm" onClick={handleStop}>
                <Square size={13} className="fill-current" /> Stop
              </Button>
            </div>
            <p className="text-caption text-muted-foreground">
              Go to the Cloud Console and do your flow. Steps appear here as you go.
            </p>
            {steps.length === 0 ? (
              <p className="text-small text-muted-foreground py-8 text-center">
                Waiting for your first action…
              </p>
            ) : (
              <ol className="space-y-1.5">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <span className="text-caption text-primary font-semibold">{i + 1}</span>
                    <ActionTag action={s.action} />
                    <span className="text-small truncate">{s.title}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {mode === 'refining' && (
          <div className="flex flex-col items-center pt-10 text-center">
            <span className="bg-accent flex h-16 w-16 items-center justify-center rounded-full">
              <Sparkles size={28} className="text-primary" />
            </span>
            <h1 className="text-display mt-4">Polishing your guide</h1>
            <p className="text-body text-muted-foreground mt-2 max-w-xs">
              Baymax is double-checking your {steps.length} {steps.length === 1 ? 'step' : 'steps'}{' '}
              against the official Google Cloud documentation and rewriting them so they read like a
              tutorial.
            </p>
            <p className="text-caption text-muted-foreground mt-4 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> This can take a little while…
            </p>
            <Button variant="ghost" size="sm" className="mt-6" onClick={skipRefine}>
              Skip — edit the raw recording
            </Button>
          </div>
        )}

        {mode === 'review' && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-caption text-muted-foreground font-medium">GUIDE NAME</label>
              <Input
                className="mt-1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name your guide"
              />
            </div>
            {refineNote?.ok && (
              <div className="border-primary/30 bg-accent text-caption text-accent-foreground flex items-start gap-2 rounded-lg border px-3 py-2">
                <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Polished with AI against the Google Cloud docs — review the wording before saving.
                  {refineNote.summary ? ` ${refineNote.summary}` : ''}
                </span>
              </div>
            )}
            {refineNote && !refineNote.ok && (
              <div className="border-border bg-muted text-caption text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  AI polish didn&apos;t go through — these are your raw recorded steps. You can
                  retry with &quot;Refine with AI&quot; below.
                </span>
              </div>
            )}
            <p className="text-caption text-muted-foreground">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'} — edit, reorder, or delete
              before saving.
            </p>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <StepRow
                  key={i}
                  index={i}
                  total={steps.length}
                  step={s}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <Button onClick={handleSave} disabled={!steps.length || saveState === 'saving'}>
                {isSaved ? <Check size={15} /> : <Save size={15} />}
                {saveState === 'saving' ? 'Saving…' : isSaved ? 'Saved' : 'Save guide'}
              </Button>
              {saveState === 'error' && (
                <p className="text-caption text-danger flex items-center gap-1.5">
                  <AlertCircle size={14} /> {saveError}
                </p>
              )}
              <Button variant="outline" onClick={handleTry} disabled={!steps.length}>
                <Play size={15} /> Try it now
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={!steps.length}>
                <Download size={15} /> Download JSON
              </Button>
              <Button variant="outline" onClick={handleExportPdf} disabled={!steps.length || exportingPdf}>
                <FileText size={15} /> {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </Button>
              {/* Not shown once a polish landed — covers a failed/skipped pass
                  and guides opened pre-recorded (initialSteps). */}
              {!refineNote?.ok && (
                <Button variant="outline" onClick={() => refine(steps)} disabled={!steps.length}>
                  <Sparkles size={15} /> Refine with AI
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDiscard}>
                <RotateCcw size={14} /> Discard &amp; re-record
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
