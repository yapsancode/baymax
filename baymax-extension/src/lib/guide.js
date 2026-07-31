// Bridges the side panel's guide steps to the content script running on
// console.cloud.google.com (public/guide-overlay.js). The content script
// highlights, fills, or clicks elements matching a step's selector.

const GCP_ORIGIN = /^https:\/\/console\.cloud\.google\.com/

export function isExtensionContext() {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.tabs?.query
}

// The specific Console tab this guide run is pinned to. Every tab-touching
// operation resolves through getGuidedTab(), so once a run adopts a tab the
// guide keeps following THAT tab — another GCP tab gaining focus (or
// navigating) can't hijack highlights, off-track checks, or auto-advance.
let guidedTabId = null

// Forget the pinned tab. Called when a new guide run (or recording) starts so
// it adopts the tab the user is on now instead of one from a previous run.
export function resetGuidedTab() {
  guidedTabId = null
}

async function getGuidedTab() {
  if (!isExtensionContext()) return null
  // Pinned: follow that exact tab, focused or not. A pinned tab that left the
  // Console is treated as unavailable (same UX as before), but the pin is kept
  // so the guide recovers the moment the user brings it back.
  if (guidedTabId != null) {
    try {
      const tab = await chrome.tabs.get(guidedTabId)
      return GCP_ORIGIN.test(tab.url || '') ? tab : null
    } catch {
      guidedTabId = null // the pinned tab was closed — re-adopt below
    }
  }
  let tab
  try {
    ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  } catch {
    return null
  }
  if (!tab || !GCP_ORIGIN.test(tab.url || '')) return null
  guidedTabId = tab.id
  return tab
}

// Enumerate the tab's frames, falling back to the top frame when the
// webNavigation API is unavailable.
async function getFrames(tabId) {
  try {
    const allFrames = await chrome.webNavigation.getAllFrames({ tabId })
    if (allFrames?.length) return allFrames
  } catch {
    /* webNavigation unavailable — fall back to the top frame */
  }
  return [{ frameId: 0 }]
}

// The GCP Console renders most pages inside a same-origin iframe, so the target
// element may live in a different frame than the top-level document. Content
// scripts only receive messages sent to frame 0 by default, so we broadcast to
// every frame in the tab and use the first one that reports success.
async function sendGuideCommand(message) {
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }

  const frames = await getFrames(tab.id)

  let lastError = { ok: false, error: 'no-content-script' }
  let anyOk = false
  for (const frame of frames) {
    let result
    try {
      const result = await chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId })
      if (result?.ok) return result
      if (result) lastError = result
    } catch {
      continue /* this frame has no listener (e.g. about:blank) — try the next */
    }
    if (result?.ok) {
      for (const other of frames) {
        if (other.frameId === frame.frameId) continue
        chrome.tabs
          .sendMessage(
            tab.id,
            { type: 'BAYMAX_GUIDE', action: 'clear' },
            { frameId: other.frameId },
          )
          .catch(() => {})
      }
      return result
    }
    if (result) lastError = result
  }
  return anyOk ? { ok: true } : lastError
}

// Send a command to EVERY frame, not just the first that answers ok. 'clear'
// succeeds trivially in the top frame while the highlight usually lives in the
// console's content iframe, so first-win semantics left stale outlines,
// mascots, and live watchers behind there; recording likewise has to capture
// clicks in whichever frame they happen. ok if ANY frame acknowledged.
async function broadcastGuideCommand(message) {
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }

  const frames = await getFrames(tab.id)
  const results = await Promise.all(
    frames.map(
      (frame) =>
        chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId }).catch(() => null), // no listener in this frame (e.g. about:blank)
    ),
  )
  if (results.some((r) => r?.ok)) return { ok: true }
  return results.find(Boolean) ?? { ok: false, error: 'no-content-script' }
}

// Highlight the element for a step without acting on it: pulsing outline plus
// the animated mascot pointing at it with the step text in a speech bubble and
// a "Step X of Y" sign board. extras: { stepNumber, totalSteps, cheer }.
export function highlightStep(step, extras = {}) {
  return sendGuideCommand({
    type: 'BAYMAX_GUIDE',
    action: 'highlight',
    selector: step.selector,
    extraSelector: step.extraSelector,
    role: step.role,
    name: step.name,
    text: step.text,
    href: step.href,
    avoidHref: step.avoidHref,
    avoidText: step.avoidText,
    exactName: step.exactName,
    requireSelector: step.requireSelector,
    revealSelector: step.revealSelector,
    revealValue: step.revealValue,
    title: step.title,
    message: step.description,
    stepAction: step.action,
    // advanceOnValueMatch: a fill step that only completes once the typed text
    // contains its `value` (e.g. the search steps, where "Cloud SQL" is the
    // canonical query) — instead of on any pause in typing. Off by default:
    // most fill values are examples (instance IDs) or secrets (passwords),
    // where whatever the user typed is the right answer.
    matchValue: step.advanceOnValueMatch ? step.value : undefined,
    stepNumber: extras.stepNumber,
    totalSteps: extras.totalSteps,
    cheer: extras.cheer,
  })
}

// Show the mascot in "lost" mode — no highlight, just Baymax at the edge of
// the page offering a clickable "Take me back" button. Used when the user
// wandered to a page the current step doesn't live on.
// `opts` ({ title, message }) overrides the default "wrong page?" wording — the
// escape-hatch flow uses it to offer a shortcut rather than imply a mistake.
// `opts.mood` picks how he reacts: the default droops (wrong page), 'confused'
// tilts his head with a "?" instead — right page, missing element. The button
// is unaffected either way.
export function showLostMascot(opts = {}) {
  return sendGuideCommand({
    type: 'BAYMAX_GUIDE',
    action: 'lost',
    title: opts.title,
    message: opts.message,
    mood: opts.mood,
  })
}

// Perform the step's action (click or fill), highlighting the element first.
export function runStepAction(step) {
  return sendGuideCommand({
    type: 'BAYMAX_GUIDE',
    action: step.action === 'fill' ? 'fill' : 'click',
    selector: step.selector,
    extraSelector: step.extraSelector,
    role: step.role,
    name: step.name,
    text: step.text,
    href: step.href,
    avoidHref: step.avoidHref,
    avoidText: step.avoidText,
    exactName: step.exactName,
    requireSelector: step.requireSelector,
    revealSelector: step.revealSelector,
    revealValue: step.revealValue,
    value: step.value,
  })
}

// Remove any highlight overlay left on the page.
export function clearGuideHighlight() {
  return sendGuideCommand({ type: 'BAYMAX_GUIDE', action: 'clear' })
}

// Capture a snapshot of the active GCP tab's visible interactive elements, used
// to self-heal a step whose authored selector no longer matches. Unlike the
// other commands we DON'T take the first frame that answers: the element we're
// hunting for could be in any same-origin iframe, so we ask every frame and
// merge their element lists (deduped). Returns { ok, url, elements } or an error.
export async function captureSnapshot() {
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }

  const frames = await getFrames(tab.id)

  const merged = []
  const seen = new Set()
  let url = tab.url
  for (const frame of frames) {
    let res
    try {
      res = await chrome.tabs.sendMessage(
        tab.id,
        { type: 'BAYMAX_GUIDE', action: 'snapshot' },
        { frameId: frame.frameId },
      )
    } catch {
      continue // no content script in this frame (e.g. about:blank)
    }
    if (!res?.ok || !res.elements) continue
    if (res.top && res.url) url = res.url
    for (const el of res.elements) {
      const key = `${el.selector || ''}|${el.name || ''}|${el.href || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(el)
    }
  }

  if (!merged.length) return { ok: false, error: 'empty-snapshot', url }
  // Cap the merged set so a busy console page can't blow up the prompt.
  return { ok: true, url, elements: merged.slice(0, 120) }
}

// Build a light text summary of the Console page the user is currently viewing,
// to ground page-aware chat ("what does this graph mean"). Like captureSnapshot
// it asks EVERY frame — the console renders pages in a same-origin iframe, so the
// real headings live in a child frame, not frame 0 — and merges their headings,
// preferring the top frame's URL/title. Returns a single formatted string ready
// to send as `page_context`, or null when there's no reachable Console tab (so
// the caller simply omits it and chat behaves exactly as before).
export async function capturePageContext() {
  const tab = await getGuidedTab()
  if (!tab) return null

  const frames = await getFrames(tab.id)

  let url = tab.url
  let title = ''
  const headings = []
  const seen = new Set()
  for (const frame of frames) {
    let res
    try {
      res = await chrome.tabs.sendMessage(
        tab.id,
        { type: 'BAYMAX_GUIDE', action: 'page-context' },
        { frameId: frame.frameId },
      )
    } catch {
      continue // no content script in this frame (e.g. about:blank)
    }
    if (!res?.ok) continue
    // The top frame owns the address-bar URL and the document title; child
    // frames carry their own iframe URL/title, which we ignore for those fields.
    if (res.top) {
      if (res.url) url = res.url
      if (res.title) title = res.title
    } else if (!title && res.title) {
      title = res.title
    }
    for (const h of res.headings || []) {
      const key = h.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      headings.push(h)
    }
  }

  const lines = []
  if (title) lines.push(`Page: ${title}`)
  if (url) lines.push(`URL: ${url}`)
  if (headings.length) lines.push(`Visible sections: ${headings.slice(0, 25).join(' · ')}`)
  if (!lines.length) return null
  return `[The user is currently viewing this Google Cloud Console page]\n${lines.join('\n')}`
}

// Gather everything the chat model needs to see the user's page — the text
// summary and a screenshot of the visible tab — in parallel, tolerating either
// failing (a capture can be rate-limited, or there may be no Console tab). The
// `page` object it returns is what api.sendChat's 5th argument expects; returns
// null when NEITHER is available, so the caller can pass null and get today's
// page-blind behavior. Callers gate this on the user's page-share preference.
export async function captureChatPage() {
  const [pageContext, screenshot] = await Promise.all([
    capturePageContext().catch(() => null),
    captureGuidedTabScreenshot().catch(() => null),
  ])
  if (!pageContext && !screenshot) return null
  return { pageContext, screenshot }
}

// PrereqGate needs "is the console open and active RIGHT NOW", re-evaluated
// fresh on every call. Deliberately does NOT go through
// sendGuideCommand()/getGuidedTab() — those STICK to a pinned tab once a
// guide adopts one, by design (so an in-progress guide survives the user
// briefly switching windows). Reusing that here was the bug: the first
// check pinned to whatever tab happened to be active, and every later
// check — including Recheck — kept reporting THAT tab's state even after
// the user switched to a completely different window. This queries the
// current window's active tab from scratch every time instead.
export async function checkEnvironment() {
  if (!isExtensionContext()) {
    return {
      ok: true,
      consoleOpen: false,
      languageEnglish: false,
      projectId: null,
      projectSelected: false,
    }
  }
  let tab
  try {
    ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  } catch {
    tab = null
  }
  const consoleOpen = !!tab && GCP_ORIGIN.test(tab.url || '')
  if (!consoleOpen) {
    return {
      ok: true,
      consoleOpen: false,
      languageEnglish: false,
      projectId: null,
      projectSelected: false,
    }
  }

  let projectId = null
  try {
    projectId = new URL(tab.url).searchParams.get('project')
  } catch {
    /* malformed URL — no project to report */
  }

  // consoleOpen/projectId above come straight from the tab's own URL — no
  // content script needed. Only language genuinely needs the page's DOM
  // (document.lang reflects Google's actual rendered language more
  // reliably than the `hl` URL param, which is usually absent), so this is
  // the one field that still asks the content script.
  //
  // Ask EVERY frame rather than betting on one: GCP renders most pages
  // inside a same-origin iframe and which frame (if any) actually carries a
  // correct <html lang> isn't something we can verify without a live
  // console session, so treat the page as English if ANY frame says so
  // instead of risking a false "fail" by trusting the wrong one.
  let languageEnglish = false
  let contentScriptReachable = false
  try {
    const frames = await getFrames(tab.id)
    const results = await Promise.all(
      frames.map((f) =>
        chrome.tabs
          .sendMessage(
            tab.id,
            { type: 'BAYMAX_GUIDE', action: 'check-env' },
            { frameId: f.frameId },
          )
          .catch(() => null),
      ),
    )
    console.log(
      '[Baymax] language check per frame:',
      results.map((r) => r?.languageEnglish),
    )
    // Distinct from "checked and it's not English": if NO frame answered at
    // all, there's no content script here to ask in the first place — almost
    // always because this tab was already open before the extension was
    // (re)loaded. Chrome only injects content scripts at page load, so an
    // extension reload never reaches already-open tabs; only reloading the
    // PAGE does. PrereqGate surfaces this distinctly so "reload the tab" is
    // an explicit, visible fix instead of a silent false fail.
    contentScriptReachable = results.some((r) => r != null)
    languageEnglish = results.some((r) => r?.ok && r.languageEnglish)
  } catch {
    /* no frames responded — leave false */
  }

  return {
    ok: true,
    consoleOpen,
    languageEnglish,
    projectId,
    projectSelected: !!projectId,
    contentScriptReachable,
  }
}

// Force-reloads the active console tab so it picks up a content script that
// isn't there yet (see contentScriptReachable above for why that happens).
// Deliberately explicit/user-triggered rather than automatic: the tab could
// have unrelated in-progress work (a half-filled form) that a silent reload
// would discard.
export async function reloadGuidedTab() {
  if (!isExtensionContext()) return { ok: false, error: 'no-gcp-tab' }
  let tab
  try {
    ;[tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  } catch {
    return { ok: false, error: 'no-gcp-tab' }
  }
  if (!tab || !GCP_ORIGIN.test(tab.url || '')) return { ok: false, error: 'no-gcp-tab' }
  try {
    await chrome.tabs.reload(tab.id)
    return { ok: true }
  } catch {
    return { ok: false, error: 'navigate-failed' }
  }
}

// Force-navigates the guided Console tab to `url` (unlike openGcpConsole,
// which only focuses an existing tab and never redirects it — see there for
// why). Used for one-off "take me to this exact page" actions, e.g. the
// PrereqGate "Enable billing" button. Falls back to opening a fresh tab
// directly at `url` when there's no guided tab yet.
export async function navigateToUrl(url) {
  const tab = await getGuidedTab()
  if (!tab) return openGcpConsole(url)
  try {
    await chrome.tabs.update(tab.id, { url })
    return { ok: true }
  } catch {
    return { ok: false, error: 'navigate-failed' }
  }
}

// Returns the URL of the guided GCP Console tab, if any.
export async function getCurrentGcpUrl() {
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }
  return { ok: true, url: tab.url }
}

// Steps from non-curated sources (recordings, AI blueprints) can carry a URL
// pattern that isn't a valid regex — never let that throw inside a React
// effect. Returns null for an invalid pattern; the caller picks the safe default.
function safeMatch(pattern, url) {
  try {
    return new RegExp(pattern).test(url || '')
  } catch {
    return null
  }
}

// True if `url` matches the page a step's selector lives on. Steps without a
// urlPattern — or with one that doesn't compile — are considered
// location-agnostic (always "on track").
export function isOnStepPage(step, url) {
  if (!step.urlPattern) return true
  return safeMatch(step.urlPattern, url) ?? true
}

// Sends the guided GCP Console tab back to the page a step needs, e.g. after
// the user clicked the wrong button and ended up somewhere else. Prefers
// browser history (like the user pressing the back button) so a one-hop wander
// returns to the exact page state they left — but verifies where the tab
// actually landed: a multi-page wander means one goBack still ends on a wrong
// page, so we fall back to hard-navigating to the step's known URL (also the
// fallback when there's no history at all).
const GO_BACK_SETTLE_MS = 500
export async function goToStepPage(step) {
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }

  try {
    await chrome.tabs.goBack(tab.id)
    // goBack resolves when the navigation commits, but a GCP SPA route change
    // can settle the URL a beat later — give it a moment before judging.
    await new Promise((resolve) => setTimeout(resolve, GO_BACK_SETTLE_MS))
    let landed
    try {
      landed = await chrome.tabs.get(tab.id)
    } catch {
      return { ok: false, error: 'no-gcp-tab' } // tab closed while navigating
    }
    if (isOnStepPage(step, landed.url)) return { ok: true }
    /* still not on the step's page — fall through to the hard navigation */
  } catch {
    /* no history to go back to — fall back to the step's known URL */
  }

  if (!step.url) return { ok: false, error: 'navigate-failed' }
  try {
    await chrome.tabs.update(tab.id, { url: step.url })
    return { ok: true }
  } catch {
    return { ok: false, error: 'navigate-failed' }
  }
}

// Send the guided tab straight to a URL. Backs a step's `fallbackUrl` escape
// hatch: when an element genuinely can't be found, the guide stops pretending
// and takes the user to the page the step was leading to. Unlike goToStepPage
// this never tries history — the point is to go FORWARD to a known destination,
// not back to the page the step lives on.
export async function goToUrl(url) {
  if (!url || !GCP_ORIGIN.test(url)) return { ok: false, error: 'navigate-failed' }
  const tab = await getGuidedTab()
  if (!tab) return { ok: false, error: 'no-gcp-tab' }
  try {
    await chrome.tabs.update(tab.id, { url })
    return { ok: true }
  } catch {
    return { ok: false, error: 'navigate-failed' }
  }
}

// One-click "connect me to the Console": focus an existing Console tab in this
// window, or open a fresh one, and pin the guide to it. Fixes the two ways the
// guide can start disconnected:
//  - no Console tab open at all (first-time users) — we create one, and a tab
//    created AFTER the extension loaded always gets a fresh content script;
//  - a Console tab that predates the extension (re)load — its content script
//    is orphaned, so we ping it (a no-op 'clear') and reload the tab ONLY when
//    it doesn't answer. This replaces the manual "reload the GCP page so the
//    extension can track it" chore.
// `url` (optional) is where a created tab should land — e.g. the current
// step's page. An existing tab is focused, never navigated: the off-track
// flow's "Take me back" owns on-guide navigation.
export async function openGcpConsole(url) {
  if (!isExtensionContext()) return { ok: false, error: 'no-gcp-tab' }
  const target = url && GCP_ORIGIN.test(url) ? url : 'https://console.cloud.google.com/'
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const gcpTabs = tabs.filter((t) => GCP_ORIGIN.test(t.url || ''))
    const existing = gcpTabs.find((t) => t.active) || gcpTabs[0]
    if (!existing) {
      const tab = await chrome.tabs.create({ url: target, active: true })
      guidedTabId = tab.id
      return { ok: true, created: true }
    }
    guidedTabId = existing.id
    await chrome.tabs.update(existing.id, { active: true })
    let alive = false
    for (const frame of await getFrames(existing.id)) {
      try {
        const res = await chrome.tabs.sendMessage(
          existing.id,
          { type: 'BAYMAX_GUIDE', action: 'clear' },
          { frameId: frame.frameId },
        )
        if (res) {
          alive = true
          break
        }
      } catch {
        continue /* no listener in this frame — try the next */
      }
    }
    if (!alive) await chrome.tabs.reload(existing.id)
    return { ok: true, created: false, reloaded: !alive }
  } catch {
    return { ok: false, error: 'no-gcp-tab' }
  }
}

// Calls back when the user interacts with the guide on the GCP Console tab:
//  - onClicked(selector): clicked the highlighted element
//  - onFilled(selector, value): typed into the highlighted input
//  - onDismissed(): closed the mascot with its × button
//  - onGoBack(): clicked the lost mascot / its "Take me back" button
// Returns an unsubscribe function.
export function onGuideStepEvent({ onClicked, onFilled, onDismissed, onGoBack } = {}) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return () => {}

  const listener = (msg) => {
    if (msg?.type === 'BAYMAX_GUIDE_CLICKED') onClicked?.(msg.selector)
    if (msg?.type === 'BAYMAX_GUIDE_FILLED') onFilled?.(msg.selector, msg.value)
    if (msg?.type === 'BAYMAX_GUIDE_DISMISSED') onDismissed?.()
    if (msg?.type === 'BAYMAX_GUIDE_GO_BACK') onGoBack?.()
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

// Calls cb(url) whenever the GCP Console tab navigates (including SPA route
// changes, which Chrome reports via tabs.onUpdated). Used to detect that a
// step is done — e.g. landing on /sql/choose-instance-engine proves the user
// clicked "Create instance". Returns an unsubscribe function.
export function onGcpUrlChanged(cb) {
  if (!isExtensionContext() || !chrome.tabs?.onUpdated) return () => {}

  const listener = (tabId, changeInfo) => {
    // Only the pinned guided tab drives the guide. Identity (not focus) is the
    // filter: another GCP tab can't flag off-track or auto-advance a step just
    // because the user switched to it while it navigated — and a guided-tab
    // navigation that finishes while the user is elsewhere still counts.
    // No pin yet = ignore the event: adopting from a navigation would pin
    // whichever tab happened to move first, not the tab being guided.
    if (guidedTabId == null || tabId !== guidedTabId) return
    if (changeInfo.url && GCP_ORIGIN.test(changeInfo.url)) cb(changeInfo.url)
  }
  chrome.tabs.onUpdated.addListener(listener)
  return () => chrome.tabs.onUpdated.removeListener(listener)
}

// True if `url` proves this step has been completed (the user reached the
// page the step's action leads to). Steps without advanceOnUrlPattern — or
// with one that doesn't compile — never auto-complete from a URL.
export function stepCompletedByUrl(step, url) {
  if (!step.advanceOnUrlPattern) return false
  return safeMatch(step.advanceOnUrlPattern, url) ?? false
}

// ── Recorder ──────────────────────────────────────────────────────────────
// Tell the content script to start/stop capturing the user's clicks and typing
// on the GCP Console tab. While recording, each action arrives via
// onRecordedAction as a fingerprint the resilient resolver can replay later.

export function startRecording() {
  // A recording targets the tab the user is on RIGHT NOW — drop any pin left
  // by an earlier guide run before sendGuideCommand adopts the active tab.
  resetGuidedTab()
  return sendGuideCommand({ type: 'BAYMAX_GUIDE', action: 'record-start' })
}

export function stopRecording() {
  return sendGuideCommand({ type: 'BAYMAX_GUIDE', action: 'record-stop' })
}

// Calls cb({ recordAction, fingerprint, value, isParameter, url }) for each
// recorded interaction. Returns an unsubscribe function.
export function onRecordedAction(cb) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return () => {}
  const listener = (msg) => {
    if (msg?.type === 'BAYMAX_RECORD_ACTION') cb(msg)
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

// Capture what the guided tab currently shows, as a JPEG data URL. Used by the
// Recorder to attach a picture to each recorded step for the PDF export.
// captureVisibleTab shoots the ACTIVE tab of the given window — which during a
// recording is the console tab the user is clicking (recording adopts the
// active tab). Returns null on any failure (no permission for the tab's URL,
// or Chrome's ~2 captures/second rate limit under rapid clicking) so a missing
// picture never breaks the recording — that step just exports text-only.
export async function captureGuidedTabScreenshot() {
  if (!isExtensionContext()) return null
  try {
    const tab = await getGuidedTab()
    if (!tab) return null
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 })
  } catch (e) {
    // Chrome only allows captureVisibleTab with the activeTab (granted by
    // clicking the Baymax icon) or <all_urls> permission — a site host
    // permission alone is NOT enough. Log the reason instead of failing
    // silently; the recording itself continues without a picture.
    console.warn('[Baymax] screenshot failed:', e?.message || e)
    return null
  }
}

// ── Generalizing recorded targets across projects/instances ────────────────
// A recorded element's accessible name often embeds the specific resource it
// was recorded on — e.g. the ⋮ menu reads "View more actions for my-instance-a".
// Replaying on another project/instance then fails to match that exact name. We
// pull the volatile identifiers out of the page URL (the project id, the
// instance/resource path segment, and any id-like token) and strip them from a
// step's name/text so it matches the SAME control on any instance.

// Console path words that are NOT volatile, so we never mistake them for a
// resource id when a path segment happens to be id-like.
const URL_PATH_STOPWORDS = new Set([
  'sql',
  'instances',
  'instance',
  'overview',
  'edit',
  'create',
  'details',
  'create-instance',
  'choose-instance-engine',
  'choose-instance',
  'connections',
  'users',
  'databases',
  'backups',
  'operations',
  'replicas',
  'configurations',
  'dashboard',
  'welcome',
  'postgres',
  'mysql',
  'sqlserver',
])

// Project ids ("directed-radius-499101-t4") and instance ids
// ("free-trial-frist-project") carry hyphens/underscores and/or digits; plain
// console path words ("instances", "overview") don't.
function looksLikeId(token) {
  return /[-_]/.test(token) || /\d/.test(token)
}

// The volatile identifiers in a GCP console URL: the `project` (and similar)
// query values, plus the instance/resource segment from the path.
export function volatileTokensFromUrl(url) {
  const tokens = new Set()
  let u
  try {
    u = new URL(url)
  } catch {
    return []
  }
  for (const [, v] of u.searchParams) {
    const val = (v || '').trim()
    if (val.length >= 3 && looksLikeId(val)) tokens.add(val)
  }
  const segs = u.pathname.split('/').map((s) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
  segs.forEach((seg, i) => {
    if (!seg || seg.length < 3) return
    const prev = (segs[i - 1] || '').toLowerCase()
    // The segment right after /instances/ is the resource id even if it has no
    // hyphen/digit; elsewhere, take any id-like, non-stopword segment.
    const isResourceId = prev === 'instances' || prev === 'instance'
    if (isResourceId || (looksLikeId(seg) && !URL_PATH_STOPWORDS.has(seg.toLowerCase()))) {
      tokens.add(seg)
    }
  })
  return Array.from(tokens)
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Query params that pin a console URL to the account it was recorded on.
const VOLATILE_QUERY_PARAMS = new Set(['project', 'organizationid', 'authuser', 'folder'])

// Make a recorded console URL shareable: strip the query params that belong to
// the RECORDER's account (?project=…, ?organizationId=…, plus any id-looking
// value) so another user's replay lands on their own project — the console
// re-adds the viewer's project on navigation, exactly like the hand-authored
// official-guide URLs, which carry no project at all. Meaningful state params
// ("deploymentType=container", "referrer=search") and matrix params (part of
// the path, ";engine=PostgreSQL") survive. Works for absolute URLs and for
// origin-relative hrefs (returns the same relativity it was given).
export function portableConsoleUrl(url) {
  if (!url) return url
  const relative = url.startsWith('/')
  // Only console URLs and origin-relative hrefs are ours to rewrite — anything
  // else (other sites, malformed strings) passes through untouched. new URL()
  // with a base does NOT throw on garbage; it would resolve it against the
  // console origin and mangle it, so this guard can't rely on the catch below.
  if (!relative && !GCP_ORIGIN.test(url)) return url
  let u
  try {
    u = new URL(url, 'https://console.cloud.google.com')
  } catch {
    return url
  }
  const kept = []
  for (const [k, v] of u.searchParams) {
    if (VOLATILE_QUERY_PARAMS.has(k.toLowerCase())) continue
    if ((v || '').length >= 3 && looksLikeId(v)) continue
    kept.push([k, v])
  }
  const qs = kept.length
    ? '?' + kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : ''
  const path = u.pathname + qs
  return relative ? path : u.origin + path
}

// Derive a step's `urlPattern` (the "am I on the right page?" regex) from a
// concrete Console URL, for steps whose author never wrote one — recorded
// guides and AI blueprints. This is what lights up the off-track banner +
// "Take me back" for non-curated guides. Rules:
//  - volatile identifiers (project id, instance id) become wildcards so the
//    pattern matches the same page on any project/instance;
//  - matrix params (";engine=PostgreSQL") are stripped so console state
//    variations don't cause false off-track;
//  - single-segment pages (/welcome — where nav/search clicks happen) return
//    undefined, keeping those steps page-agnostic;
//  - the result is always a valid regex and always matches its own input URL,
//    so "Take me back" (which falls back to navigating to step.url) can never
//    land the user on a page the pattern still rejects.
export function urlPatternFromUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return undefined
  }
  if (!GCP_ORIGIN.test(u.origin)) return undefined
  const rawSegs = u.pathname
    .split('/')
    .map((seg) => seg.split(';')[0]) // drop matrix params
    .filter(Boolean)
  if (rawSegs.length < 2) return undefined
  const tokens = new Set(volatileTokensFromUrl(url).map((t) => t.toLowerCase()))
  const parts = rawSegs.map((raw) => {
    let seg = raw
    try {
      seg = decodeURIComponent(raw)
    } catch {
      /* malformed escape — compare the raw segment */
    }
    return tokens.has(seg.toLowerCase()) ? '[^/;?#]+' : escapeRegExp(raw)
  })
  // Boundary guard: /run/create must not match /run/create-something, but must
  // still match when followed by matrix params, a query, a hash, or a subpage.
  return '/' + parts.join('/') + '(?:[/;?#]|$)'
}

// Strip volatile tokens from a label and tidy the leftover so it still reads
// naturally — "View more actions for my-instance" → "View more actions".
function generalizeLabel(label, tokens) {
  if (!label) return label
  let out = label
  for (const t of tokens) {
    if (!t) continue
    out = out.replace(new RegExp(escapeRegExp(t), 'ig'), ' ')
  }
  out = out.replace(/\s+/g, ' ').trim()
  // Drop punctuation/connector words left dangling where the token used to be.
  out = out.replace(/[\s\-:,/]+$/g, '').trim()
  out = out.replace(/\s+(for|in|of|to|on)$/i, '').trim()
  return out
}

// A recorded CSS selector that embeds a volatile token (e.g. an instance id in
// an element id) only ever matches the recorded instance — so it's dropped for
// generalized steps in favour of role + name matching.
function selectorHasToken(selector, tokens) {
  if (!selector) return false
  const lower = selector.toLowerCase()
  return tokens.some((t) => t && lower.includes(t.toLowerCase()))
}

// True when a step's recorded label looks tied to one specific resource, so the
// "Match any instance" generalization is worth offering and defaulting on.
export function detectInstanceSpecific(name, text, url) {
  const tokens = volatileTokensFromUrl(url)
  if (!tokens.length) return false
  const hay = `${name || ''} ${text || ''}`.toLowerCase()
  return tokens.some((t) => hay.includes(t.toLowerCase()))
}

// Rewrite a step so it matches the same control on any project/instance: strip
// the volatile resource identifiers from its name/text and drop a selector
// pinned to them. A no-op unless the step opted in via `generic`. The internal
// `generic`/`instanceSpecific` flags are removed from the returned step so they
// don't leak into a saved/exported guide.
export function applyGeneric(step) {
  const { generic, instanceSpecific, ...rest } = step
  if (!generic || !step.url) return rest
  const tokens = volatileTokensFromUrl(step.url)
  if (!tokens.length) return rest
  const next = { ...rest }
  const name = generalizeLabel(step.name, tokens)
  if (step.name && name && name.length >= 3 && name !== step.name) {
    next.name = name
    next.exactName = false // match by contains, not whole-string
  }
  const text = generalizeLabel(step.text, tokens)
  if (step.text && text && text.length >= 3) next.text = text
  if (selectorHasToken(step.selector, tokens)) next.selector = undefined
  return next
}

// Convert a recorded action's fingerprint into a guide step the engine can
// replay. Drops the noisy structural path from the intent (kept only as a last
// resort) and turns fill values into placeholders so secrets aren't shared.
export function recordedActionToStep(action, index) {
  const fp = action.fingerprint || {}
  // When the captured label embeds a specific resource id, default to matching
  // any instance (the user can toggle this off per-step in the review screen).
  const instanceSpecific = detectInstanceSpecific(fp.name, fp.text, action.url)
  return {
    id: index + 1,
    title: fp.name || fp.text || `Step ${index + 1}`,
    description:
      action.recordAction === 'fill'
        ? `Enter a value for "${fp.name || fp.text || 'this field'}".`
        : `Click "${fp.name || fp.text || 'this element'}".`,
    action: action.recordAction === 'fill' ? 'fill' : 'click',
    // Semantic intent for the resolver — role + name are the stable signals.
    role: fp.role || undefined,
    name: fp.name || undefined,
    text: fp.text || undefined,
    href: fp.href || undefined,
    selector: fp.domPath || undefined,
    // fill steps become parameters: keep no real value in a shared guide.
    value: action.recordAction === 'fill' ? '' : undefined,
    isParameter: action.isParameter || undefined,
    url: action.url || undefined,
    // Page-bind the step to where it was recorded (volatile ids wildcarded),
    // so wandering off mid-replay triggers off-track + "Take me back" just
    // like a curated guide. Generic pages (search/nav) yield undefined and
    // the step stays page-agnostic.
    urlPattern: action.url ? urlPatternFromUrl(action.url) : undefined,
    // Generalization (see applyGeneric): whether this step CAN match any
    // instance, and whether it currently should.
    instanceSpecific: instanceSpecific || undefined,
    generic: instanceSpecific || undefined,
  }
}
