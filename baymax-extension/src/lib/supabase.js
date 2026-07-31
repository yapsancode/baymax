// Supabase browser client. Uses the PUBLISHABLE key (safe to ship in the
// frontend) — never the secret key. The client owns the OAuth (PKCE) flow:
// it generates the code verifier, and `detectSessionInUrl` (on by default)
// exchanges the ?code= on the redirect back automatically.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.warn(
    'Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in baymax-extension/.env.local',
  )
}

export const supabase = createClient(url, key)
