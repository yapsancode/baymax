// Register gate.
//   - Calls the backend POST /auth/register (creates the Supabase auth user AND
//     mirrors it into our own `users` table so the sessions FK is satisfied).
//   - Then signs in with the same credentials via Supabase directly, the same
//     way Login does, so EntryGate's onAuthStateChange picks up the session and
//     advances into the app.
//   - If Supabase has email confirmation enabled, the backend won't return a
//     session yet — show the "check your email" message instead of signing in.

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { BaymaxLogo } from '@/components/shared'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'

export default function Register({ onRegister, onGoToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const response = await api.register({ name, email, password })
      if (!response?.access_token) {
        // Email confirmation is enabled — no session yet.
        setInfo(response?.message || 'Check your email to confirm your account.')
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      // Success: EntryGate's onAuthStateChange picks up the session and advances.
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <BaymaxLogo size="lg" />
          <h1 className="text-display mt-4">Create your account</h1>
          <p className="text-small text-muted-foreground mt-1">Sign up to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-caption text-muted-foreground">
              Name
            </label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          {error && (
            <p className="text-caption text-destructive" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-caption text-muted-foreground" role="status">
              {info}
            </p>
          )}
          <Button type="submit" variant="default" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Sign up'}
          </Button>
        </form>

        <p className="text-small text-muted-foreground mt-6 text-center">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  )
}
