// Reads the signed-in user's `role` straight from the Supabase `users` table
// (same table the backend's User model maps, column added for admin gating —
// see baymax-backend/models.py). Shared by BottomNav (Recorder tab) and the
// Dashboard sidebar (Feedback tab) so both use the identical admin check.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useUserRole() {
  const [role, setRole] = useState('user')
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id
      if (!userId) return
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      setRole(userData?.role || 'user')
    })
  }, [])
  return role
}
