// ============================================
// TECH LEAD — App.jsx
// ============================================
// Connects the side panel screens together.
//
// Two axes of navigation:
//   activeTab — 'ask' | 'tasks' | 'record'  (the persistent BottomNav)
//   screen    — 'home' | 'guidance' | 'prereqs'  (sub-screens inside the Ask tab)
//
// AppHeader (new-task + settings) and BottomNav are rendered once in
// SidebarApp and shared across every page — individual pages never
// include them.
//
// The Dashboard opens in its own Chrome tab (dashboard.html), so it is
// not a screen here — BottomNav handles that directly.
// ============================================

// ============================================

// annabelle - task

// -------- aidi and benny use same file (need to discuss)
// aidi - chatbot
// benny - home (suggestion box)
// ----------------------------

// kuberan - dashboard history
// raegen - dashboard profile
// isyraf - maintain the structure and component and login

// ============================================

import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { EntryGate } from '@/components/EntryGate'
import Home from '@/pages/Home'
import Guidance from '@/pages/Guidance'
import PrereqGate from '@/pages/Guidance/PrereqGate'
import Recorder from '@/pages/Recorder'
import Tasks from '@/pages/Tasks'
import { AppHeader, BottomNav } from '@/components/ui'
import { api } from '@/lib/api'
import { urlPatternFromUrl, isExtensionContext } from '@/lib/guide'
import { CLOUD_SQL_POSTGRES_GUIDE } from '@/lib/guides/cloudSqlPostgres'
import { CLOUD_RUN_GUIDE } from '@/lib/guides/cloudRun'
import { DEFAULT_PREREQUISITES } from '@/lib/prereqs'

// Official guides live in the BACKEND (recorded_guides, is_official) and are
// fetched at chip-tap so console-drift fixes reach users without an extension
// update. These bundled copies exist ONLY as the opt-in offline fallback the
// user must explicitly accept when the backend is unreachable.
const OFFLINE_GUIDES = {
  backend: CLOUD_RUN_GUIDE,
  database: CLOUD_SQL_POSTGRES_GUIDE,
}

// DB GuideResponse → the local guide shape Guidance runs. Guide-level extras
// (nextSteps, the Home task id) travel under `meta` in the DB. Prerequisites
// are NOT read from here — see beginGuide: the "Before we start" checklist is
// the same fixed list for every guide, never guide- or database-supplied.
const fromOfficialGuide = (g) => ({
  id: g.id,
  title: g.title,
  steps: g.steps,
  nextSteps: g.meta?.nextSteps ?? [],
})

// The actual side panel experience (the persistent BottomNav + the Ask/Tasks screens).
function SidebarApp() {
  const [activeTab, setActiveTab] = useState('ask')
  const [screen, setScreen] = useState('home')
  const [sessionId, setSessionId] = useState(null)
  const [homeKey, setHomeKey] = useState(0)
  // The guide whose steps drive navigation locally, whatever its origin: a
  // curated official guide (chip or chat), an AI blueprint, or a Recorder draft
  // ("Try it now"). Local steps are the source of truth — the backend copy saved
  // below is lossy (StepCreate drops the resolver fields: name, exactName,
  // avoidText, awaitNavigation, ...), so Guidance must never swap to it mid-run.
  // Null only when resuming a session, where the backend copy is the only source.
  const [localGuide, setLocalGuide] = useState(null)
  // When the dashboard sends LOAD_RECORDING, this holds the guide id to load.
  const [loadGuideId, setLoadGuideId] = useState(null)

  // Which chip is mid-fetch (disables the chips) and the pending offer to run
  // a bundled copy after a failed fetch ({ task, error } or null). Offline is
  // opt-in only — never a silent fallback.
  const [fetchingTask, setFetchingTask] = useState(null)
  const [offlineOffer, setOfflineOffer] = useState(null)

  // Guide fetched by a chip tap or offline copy offer — stored here so Home
  // can render it as a TaskGuideCard in the chat instead of jumping straight
  // to PrereqGate. Cleared once Home picks it up.
  const [pendingGuide, setPendingGuide] = useState(null)

  // True while Guidance is running a RECORDED DRAFT via "Try it now" — a trial
  // run, not a real task. Guidance then shows a way back to the Recorder
  // (mid-run and on the completion screen), whose draft survives the trip
  // because the Recorder stays mounted (hidden) below. Cleared whenever a real
  // guide/session takes over the Guidance screen.
  const [tryingRecording, setTryingRecording] = useState(false)

  // Page-aware chat preference, lifted here so the AppHeader toggle (top) and
  // the chat screens (Home/Guidance) share one source of truth. Default on in
  // the extension; the toggle icon is shown only on the Ask tab's chat screens.
  const [pageShare, setPageShare] = useState(() => isExtensionContext())
  const showPageShare =
    isExtensionContext() && activeTab === 'ask' && (screen === 'home' || screen === 'guidance')

  // Blueprint steps arrive with LLM-guessed URL fields ('' when unknown). The
  // page-check pattern is derived from the explicit step.url instead of
  // trusting the model's urlPattern: a derived pattern is always a valid regex
  // and always matches its own URL, so "Take me back" (which navigates to
  // step.url) can never land on a page the pattern still rejects. The model's
  // advanceOnUrlPattern is kept — there's nothing to derive it from, and the
  // guide engine treats one that doesn't compile as "never auto-complete".
  const normalizeBlueprintStep = (s) => ({
    ...s,
    url: s.url || undefined,
    urlPattern: s.url ? urlPatternFromUrl(s.url) : undefined,
    advanceOnUrlPattern: s.advanceOnUrlPattern || undefined,
  })

  // How a REAL guide starts — from a quick-start chip or from chat. Stages the
  // guide and ALWAYS shows the "Before we start" gate first, with the fixed
  // DEFAULT_PREREQUISITES checklist — never a guide- or database-supplied
  // list. The checklist's live checks (consoleOpen/languageEnglish/
  // projectSelected) are matched to items by `key` in PrereqGate, so a
  // guide-supplied list without exactly those keys would silently render
  // every item as unverified; a single fixed list sidesteps that entirely and
  // means this gate's behavior can never depend on what's in the database. No
  // backend call happens here: the session (and step 1) is only created once
  // the user clears the gate, in startGuidedSession() below — see its comment
  // for why.
  //
  // `normalize` is for AI BLUEPRINTS ONLY, whose URL fields are model guesses
  // that need sanitising. Stored guides (curated official ones and recordings)
  // carry real, live-tested fields — normalising those would overwrite them.
  //
  // Both real callers come through here so the gate can't be skipped: a second
  // start path in parallel is exactly how the chat path lost its gate before.
  const beginGuide = (rawGuide, { normalize = false } = {}) => {
    const guide = {
      ...rawGuide,
      steps: normalize ? (rawGuide.steps ?? []).map(normalizeBlueprintStep) : rawGuide.steps,
      prerequisites: DEFAULT_PREREQUISITES,
    }

    setSessionId(null)
    setTryingRecording(false)
    setLocalGuide(guide)
    setScreen('prereqs')
  }

  // Fires when the user clears the "Before we start" gate for a REAL guide
  // (never for a Recorder trial — see backToRecorder/onTryGuide, a trial
  // creates no session by design). This is the ONLY place a session/step-1
  // row gets written to Supabase: gating it here, instead of firing eagerly
  // in beginGuide, means a task the user cancels at the gate never leaves an
  // orphaned in_progress session behind. A failure here (e.g. backend down)
  // doesn't block the UI — the guide simply runs without progress persistence.
  const [startingSession, setStartingSession] = useState(false)
  const startGuidedSession = async () => {
    setStartingSession(true)
    try {
      const session = await api.createSession(localGuide.title || 'Guided session')

      // Persist steps before setting sessionId to avoid a race with listSteps
      if (localGuide.steps?.length) {
        const stepsPayload = localGuide.steps.map((s, i) => ({
          step_number: s.step_number ?? i + 1,
          title: s.title ?? null,
          description: s.description ?? null,
          action: s.action ?? 'highlight',
          selector: s.selector ?? null,
          url: s.url ?? null,
          url_pattern: s.urlPattern ?? null,
          advance_on_url_pattern: s.advanceOnUrlPattern ?? null,
          value: s.value ?? null,
        }))
        const created = await api.saveSteps(session.id, stepsPayload)

        // Adopt the backend step ids so status updates (PATCH .../steps/{id})
        // hit real rows, while every other field stays the full local version.
        setLocalGuide((g) => ({
          ...g,
          steps: g.steps.map((s, i) => ({
            ...s,
            id: created?.[i]?.id ?? s.id,
          })),
        }))
      }
      setSessionId(session.id)
    } catch (e) {
      console.error('Could not create session:', e.message)
    } finally {
      setStartingSession(false)
    }
  }

  // "I'm ready" on the gate: a Recorder trial never creates a session, a real
  // guide does (then both land on 'guidance').
  const handleGateReady = async () => {
    if (!tryingRecording) await startGuidedSession()
    setScreen('guidance')
  }

  // Chip tap: fetch the official guide from the backend (summaries → the one
  // whose meta.task matches → full guide). On any failure, offer the bundled
  // offline copy instead of silently using it.
  const startTask = async (task) => {
    setFetchingTask(task)
    try {
      const summaries = await api.listGuides()
      const summary = summaries.find((g) => g.is_official && g.meta?.task === task)
      if (!summary) throw new Error(`No official guide for "${task}" on the backend yet.`)
      const full = await api.getGuide(summary.id)
      setPendingGuide(fromOfficialGuide(full))
    } catch (e) {
      console.error('Could not fetch official guide:', e.message)
      setOfflineOffer({ task, error: e.message })
    } finally {
      setFetchingTask(null)
    }
  }

  const startOfflineCopy = () => {
    const guide = OFFLINE_GUIDES[offlineOffer?.task]
    setOfflineOffer(null)
    if (guide) setPendingGuide(guide)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleNewTask = () => {
    setHomeKey((key) => key + 1)
    setActiveTab('ask')
    setScreen('home')
    setLocalGuide(null)
    setSessionId(null)
    setPendingGuide(null)
    setOfflineOffer(null)
    setTryingRecording(false)
  }

  const resumeSession = (session) => {
    setSessionId(session.id)
    setLocalGuide(null)
    setTryingRecording(false)
    setActiveTab('ask')
    setScreen('guidance')
  }

  // "Back to editing" from a trial run: return to the Recorder, whose draft is
  // still there (it never unmounted), and clear the trial guide from Guidance.
  const backToRecorder = () => {
    setTryingRecording(false)
    setLocalGuide(null)
    setSessionId(null)
    setActiveTab('record')
    setScreen('home')
  }

  // Listen for messages from the Dashboard tab.
  useEffect(() => {
    if (!chrome?.runtime?.onMessage) return
    const listener = (msg) => {
      if (msg?.type === 'RESUME_SESSION' && msg.session) {
        resumeSession(msg.session)
      }
      if (msg?.type === 'LOAD_RECORDING' && msg.guideId) {
        setLoadGuideId(msg.guideId)
        setActiveTab('record')
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        onNewTask={handleNewTask}
        pageShare={showPageShare ? pageShare : null}
        onTogglePageShare={setPageShare}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'ask' && screen === 'home' && (
          <Home
            key={homeKey}
            onSelectTask={startTask}
            startingTask={fetchingTask}
            onStoredGuide={beginGuide}
            onDynamicGuide={(g) => beginGuide(g, { normalize: true })}
            pendingGuide={pendingGuide}
            onClearPendingGuide={() => setPendingGuide(null)}
            pageShare={pageShare}
          />
        )}
        {activeTab === 'ask' && screen === 'prereqs' && (
          <PrereqGate
            guide={localGuide}
            starting={startingSession}
            onReady={handleGateReady}
            onCancel={() => setScreen('home')}
          />
        )}
        {/* The Recorder stays MOUNTED (display:none) while other tabs show, so
            a draft recording survives "Try it now" round-trips and tab
            switches — unmounting it destroyed the draft, which is why trying a
            recording used to dead-end at the completion screen. `active` lets
            it stop a live capture when its screen is hidden. */}
        <div className={activeTab === 'record' ? 'h-full' : 'hidden'}>
          <Recorder
            active={activeTab === 'record'}
            loadGuideId={loadGuideId}
            onGuideLoaded={() => setLoadGuideId(null)}
            onTryGuide={(g) => {
              // Same fixed checklist as beginGuide — a trial run also stops
              // at the gate instead of running unchecked.
              const guide = { ...g, prerequisites: DEFAULT_PREREQUISITES }
              setLocalGuide(guide)
              setSessionId(null)
              setTryingRecording(true)
              setActiveTab('ask')
              setScreen('prereqs')
            }}
          />
        </div>
        {activeTab === 'ask' && screen === 'guidance' && (
          <Guidance
            sessionId={sessionId}
            guide={localGuide}
            onBackToRecorder={tryingRecording ? backToRecorder : undefined}
            onNewTask={handleNewTask}
            onComplete={() => {
              setScreen('home')
              setActiveTab('tasks')
            }}
            pageShare={pageShare}
          />
        )}
        {activeTab === 'tasks' && <Tasks onResumeSession={resumeSession} />}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Backend unreachable → offer the bundled copy; never use it silently. */}
      {offlineOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="border-border bg-card w-full max-w-xs rounded-xl border p-5 shadow-lg">
            <p className="text-body text-foreground font-semibold">
              Baymax couldn&apos;t reach the backend
            </p>
            <p className="text-small text-muted-foreground mt-2">{offlineOffer.error}</p>
            {OFFLINE_GUIDES[offlineOffer.task] ? (
              <p className="text-small text-muted-foreground mt-2">
                Use the built-in offline copy of this guide instead? It may be older than the live
                version.
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setOfflineOffer(null)}
                className="border-border text-small text-muted-foreground hover:bg-muted flex-1 rounded-lg border px-3 py-2 transition-colors"
              >
                Cancel
              </button>
              {OFFLINE_GUIDES[offlineOffer.task] ? (
                <button
                  onClick={startOfflineCopy}
                  className="bg-primary text-small text-primary-foreground flex-1 rounded-lg px-3 py-2 font-medium transition-opacity hover:opacity-90"
                >
                  Use offline copy
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Side panel root: EntryGate decides Login / app based on how the page was opened.
// Landing/docs/about now live in the separate baymax-marketing site.
export default function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <div className="bg-card flex h-screen w-full flex-col overflow-hidden">
            <EntryGate>
              <SidebarApp />
            </EntryGate>
          </div>
        }
      />
    </Routes>
  )
}
