// Login gate.
//   - Email/password → real Supabase auth (signInWithPassword). On success a
//     session is set and EntryGate's onAuthStateChange advances to the app.
//   - Google → TEMP stub that just calls onLogin() to enter the app, until the
//     Supabase Google provider is enabled (then switch to signInWithOAuth).

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { BaymaxLogo } from '@/components/shared'
import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export default function Login({ onLogin, onGoToRegister }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      // e.g. "Invalid login credentials", "Email not confirmed"
      setError(error.message)
      return
    }
    // Success: EntryGate's onAuthStateChange picks up the session and advances.
  }

  // TEMP: Google OAuth is blocked on Supabase provider permissions. For now the
  // button just advances into the app (no real session). Restore the real flow
  // (supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
  // window.location.origin } })) once Google sign-in is enabled.
  const handleGoogle = () => {
    onLogin()
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <BaymaxLogo size="lg" />
          <h1 className="text-display mt-4">Welcome to Baymax</h1>
          <p className="text-small text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-caption text-muted-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-caption text-muted-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p className="text-caption text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="default" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <span className="text-caption text-muted-foreground">or</span>
          <div className="bg-border h-px flex-1" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full gap-2"
          onClick={handleGoogle}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        {onGoToRegister && (
          <p className="text-small text-muted-foreground mt-6 text-center">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-foreground font-medium underline-offset-2 hover:underline"
            >
              Sign up
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
