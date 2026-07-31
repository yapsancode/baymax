// Entry context detection — is this page running in the Chrome side panel, or as a full tab/URL?
//
// Why this exists:
//   The side panel (index.html, opened via chrome.sidePanel) is the intended way in and goes
//   straight to the app. Opening either entry as a full-tab URL shows the Landing page first.
//
// How detection works:
//   chrome.tabs.getCurrent() resolves to `undefined` in the side panel and to a Tab object in a
//   normal tab. That call is async and only exists in the packed extension. So:
//     - On localhost (no chrome APIs) we fall back to DEV_DEFAULT_CONTEXT.
//     - A `?context=panel|tab` query param overrides everything — handy for previewing either
//       flow on localhost, or for manual QA inside the real extension.
//
// The side panel tags the dashboard URL it opens with `?from=app`, so an already-in-app user
// skips the Landing/Login. NOTE: that marker is a UI hint only — real auth (verifying the user
// is actually signed in) is wired in separately; don't treat `?from=app` as a security boundary.

// On localhost with no override: 'tab' is faithful to "URL open → Landing". Flip to 'panel'
// if you'd rather drop straight into the app while developing the inner screens.
const DEV_DEFAULT_CONTEXT = 'tab'

function params() {
  return new URLSearchParams(window.location.search)
}

// ?context=panel|tab — explicit override (dev preview + manual QA). Returns null if absent/invalid.
export function getContextOverride() {
  const c = params().get('context')
  return c === 'panel' || c === 'tab' ? c : null
}

// True when the page was opened from inside the app (side panel → dashboard tab).
export function isFromApp() {
  return params().get('from') === 'app'
}

// Append the from-app marker to a URL the app opens itself (e.g. the dashboard tab).
export function withFromApp(url) {
  return url + (url.includes('?') ? '&' : '?') + 'from=app'
}

// Best-effort synchronous detection. Returns 'panel' | 'tab', or null when we must ask
// chrome.tabs asynchronously (real extension only).
export function detectContextSync() {
  const override = getContextOverride()
  if (override) return override
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.getCurrent) {
    return DEV_DEFAULT_CONTEXT
  }
  return null
}

// Full detection. Uses the sync answer when available, otherwise asks chrome.tabs.getCurrent().
export async function detectContext() {
  const sync = detectContextSync()
  if (sync) return sync
  try {
    const tab = await chrome.tabs.getCurrent()
    return tab ? 'tab' : 'panel'
  } catch {
    return 'panel'
  }
}
