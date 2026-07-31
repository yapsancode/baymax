// Backend API client. Pulls the Supabase access token from the current session
// and sends it as `Authorization: Bearer <token>` on every request — that's what
// the FastAPI backend's get_current_user dependency verifies.
//
// Requires being signed in via email/password (the Google button is a temp stub
// with no session, so backend calls won't be authorized until real OAuth lands).

/* Read this if you confuse XDDDDDD
# Adding a New API Call Guide

This file is the frontend API client. 
It connects the frontend to the FastAPI backend and automatically adds the Supabase access token.

When adding a new API:

1. Create the endpoint in FastAPI

Example:

GET /tasks

2. Add the API function inside this file:

export const api = {
  getTasks: () =>
    request('/tasks'),
}

3. For POST requests, include method and body:

Example:

POST /tasks

export const api = {
  createTask: (data) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

4. Use it in your frontend:

Example:

const tasks = await api.getTasks()

await api.createTask({
  title: "New task"
})


Notes:
- Use the same path as the FastAPI route.
- GET requests usually only need request('/path').
- POST/PUT/PATCH requests need method and body.
- Do not manually add Authorization headers. The request() function handles authentication automatically.
- Keep all backend API calls inside this file so frontend components stay clean.
*/
import { supabase } from '@/lib/supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...options.headers,
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(body?.detail || `${res.status} ${res.statusText}`)
  }
  return body
}

// POST /chat is a Server-Sent-Events stream: zero or more
// {"event":"delta","text":...} frames (text mode, token-by-token) followed by
// exactly one {"event":"final", ...ChatResponse} frame. onDelta (optional) is
// called with the ACCUMULATED text so far; the returned promise resolves with
// the final response object ({ type, message?, data?, blueprint_title? }).
//
// `page` (optional) grounds page-aware chat: { pageContext, screenshot } from
// capturePageContext() + captureGuidedTabScreenshot(). Either may be null; the
// backend simply omits what it doesn't get. Never send images inside `history`.
async function sendChatStream(message, onDelta, history = [], context = null, page = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  }
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      history,
      context,
      page_context: page?.pageContext ?? null,
      screenshot: page?.screenshot ?? null,
    }),
  })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json())?.detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line
    const frames = buffer.split('\n\n')
    buffer = frames.pop() // keep the (possibly partial) last frame

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const event = JSON.parse(line.slice(6))
      if (event.event === 'delta') {
        accumulated += event.text
        onDelta?.(accumulated)
      } else if (event.event === 'final') {
        return event
      }
    }
  }
  throw new Error('Chat stream ended without a final response')
}

export const api = {
  sendChat: sendChatStream,

  // POST /auth/register. Creates the Supabase auth user and mirrors it into our
  // own `users` table. Returns { access_token, user_id } if email confirmation
  // is disabled, otherwise { message, user_id }. No auth header is required (the
  // caller isn't signed in yet); request() only attaches one if a session
  // already happens to exist, which is harmless here.
  register: ({ name, email, password }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  createSession: (title) =>
    request('/sessions', { method: 'POST', body: JSON.stringify({ title }) }),
  listSessions: () => request('/sessions'),
  getSession: (id) => request(`/sessions/${id}`),
  deleteSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }), // ← add this

  listSteps: (session_id) => request(`/sessions/${session_id}/steps`),
  saveSteps: (session_id, steps) =>
    request(`/sessions/${session_id}/steps`, { method: 'POST', body: JSON.stringify(steps) }),
  updateStepStatus: (session_id, step_id, status) =>
    request(`/sessions/${session_id}/steps/${step_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateSessionStatus: (session_id, status) =>
    request(`/sessions/${session_id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateSession: (session_id, patch) =>
    request(`/sessions/${session_id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  // ── Recorded guides ──────────────────────────────────────────────────────
  // Persist a guide the user recorded so it survives leaving the Recorder.
  // `guide` is the { title, steps } object buildGuide() produces. listGuides
  // returns lightweight summaries (no steps); getGuide loads one in full to run.
  saveGuide: (guide) => request('/guides', { method: 'POST', body: JSON.stringify(guide) }),
  listGuides: () => request('/guides'),
  getGuide: (id) => request(`/guides/${id}`),
  deleteGuide: (id) => request(`/guides/${id}`, { method: 'DELETE' }),

  // Admin-only guide management — unscoped listing/deletion for the dashboard.
  listAllGuides: (params = {}) => {
    const q = new URLSearchParams()
    if (params.is_official != null) q.set('is_official', params.is_official)
    if (params.search) q.set('search', params.search)
    if (params.page) q.set('page', params.page)
    if (params.page_size) q.set('page_size', params.page_size)
    return request(`/guides/admin?${q}`)
  },
  adminDeleteGuide: (id) => request(`/guides/admin/${id}`, { method: 'DELETE' }),

  // POST /tts — Gemini TTS (the Baymax voice). Returns an audio/wav Blob, so it
  // bypasses request()'s JSON parsing with its own fetch (same precedent as
  // sendChatStream). Public route (rate-limited per IP); auth header attached
  // if a session exists but isn't required.
  synthesizeSpeech: async (text) => {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
    const res = await fetch(`${BASE_URL}/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.blob()
  },

  // Self-heal a step whose selector stopped matching. Sends the failing step's
  // intent plus a snapshot of the page's real interactive elements; the backend
  // LLM returns the element that now matches (selector copied verbatim from the
  // snapshot). Public route — works even before sign-in (auth header is added if
  // present but isn't required). Returns { ok, intent }.
  repairStep: (payload) =>
    request('/guidance/repair', { method: 'POST', body: JSON.stringify(payload) }),

  // Refine a just-recorded guide: Gemini cross-checks the workflow against the
  // official Google Cloud documentation and rewrites step titles/descriptions
  // so the guide reads like a tutorial. The recorded actions and technical
  // metadata are preserved server-side by construction. `guide` is the
  // buildGuide() export shape ({ title, steps } — parameter values already
  // blanked, so no secrets leave the panel). Returns { ok, title, steps,
  // summary }; treat ok=false or a thrown error as "keep the raw recording".
  // Public route (rate-limited per IP), same family as /guidance/repair.
  refineGuide: (guide, signal) =>
    request('/guidance/refine', { method: 'POST', body: JSON.stringify(guide), signal }),

  // ── Guide feedback ───────────────────────────────────────────────────────
  // Step thumbs-down. session_id is optional (recorder trials/offline guides
  // have no backend session); status is always 'fail' from the UI control.
  submitStepFeedback: (payload) => request('/feedback', { method: 'POST', body: JSON.stringify(payload) }),
  // Fired once a guide completes — reports the final step as success; the
  // backend skips the insert if that step already has feedback for this session.
  submitCompletionFeedback: (payload) =>
    request('/feedback/completion', { method: 'POST', body: JSON.stringify(payload) }),
  // Admin-only listing for the Dashboard Feedback tab. Backend returns 403 for
  // non-admins regardless of what the frontend shows.
  listFeedback: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')),
    )
    const qs = query.toString()
    return request(`/feedback${qs ? `?${qs}` : ''}`)
  },
  adminDeleteFeedback: (id) => request(`/feedback/${id}`, { method: 'DELETE' }),

  // Sign out. supabase.auth.signOut() revokes the session with Supabase AND
  // clears the stored token from localStorage — so there's no token left to send.
  // EntryGate listens for the resulting SIGNED_OUT event and returns to Login.
  logout: () => supabase.auth.signOut(),

  // The signed-in user's profile for display. Reads straight from the Supabase
  // session (no backend call): email is the login email, name comes from the
  // metadata we set at register (auth_service.register_user → options.data.name).
  // Returns null if there's somehow no session.
  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser()
    const u = data.user
    if (!u) return null
    return { name: u.user_metadata?.name || u.email, email: u.email }
  },
}

// Dev-only: test from the browser console, e.g.
//   await baymaxApi.createSession('From the frontend')
//   await baymaxApi.listSessions()
if (import.meta.env.DEV) {
  window.baymaxApi = api
}
