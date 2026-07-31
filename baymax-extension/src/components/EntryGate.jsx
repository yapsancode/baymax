// Shared entry gate for both surfaces (the side panel app AND the dashboard).
//
// Flow: Login → app. The starting stage depends on how the page was opened:
//   - opened from the app (?from=app)  → straight to the app (already signed in upstream)
//   - persisted Supabase session       → straight to the app (stay signed in)
//   - side panel or cold full-tab, no session → start at Login
//
// The public landing page was moved to the separate baymax-marketing site.
//
// The starting stage is resolved ONCE, behind the splash, after BOTH the surface
// context and the persisted-session check have settled — so a returning user never
// sees the Login form flash before being moved to the app.

import { useEffect, useState } from 'react'
import { isFromApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { BaymaxLogo } from '@/components/shared'
import Login from '@/pages/Login'
import Register from '@/pages/Register'

function Splash() {
  // Shown while the surface context and the persisted-session check resolve
  // (a few ms — Supabase reads the session from localStorage).
  return (
    <div className="bg-card flex h-full w-full items-center justify-center">
      <BaymaxLogo size="lg" />
    </div>
  )
}

export function EntryGate({ children }) {
  const [stage, setStage] = useState(() => (isFromApp() ? 'app' : null))

  // Resolve the starting stage once: wait for the persisted-session check,
  // so a signed-in user lands directly in the app and a signed-out user lands
  // directly on Login.
  useEffect(() => {
    if (stage !== null) return
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStage(data.session ? 'app' : 'login')
    })
    return () => {
      cancelled = true
    }
  }, [stage])

  // After the initial resolve: react to live auth changes (login, OAuth
  // return, sign-out from another surface).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setStage('app')
      // Explicit sign-out → back to Login. Keyed on the event (not just a null
      // session) so a cold open with no session stays on Login.
      else if (event === 'SIGNED_OUT') setStage('login')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (stage === null) return <Splash />
  if (stage === 'login') {
    return <Login onLogin={() => setStage('app')} onGoToRegister={() => setStage('register')} />
  }
  if (stage === 'register') {
    return <Register onRegister={() => setStage('app')} onGoToLogin={() => setStage('login')} />
  }
  return children
}
