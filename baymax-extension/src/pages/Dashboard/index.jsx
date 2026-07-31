// Dashboard shell — opens in its own Chrome tab (dashboard.html).
// Uses HashRouter (not BrowserRouter): the extension serves dashboard.html as a
// static file with no server-side fallback, so routing has to live in the URL
// hash (dashboard.html#/profile). DashboardLayout renders the sidebar + <Outlet>.

import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { EntryGate } from '@/components/EntryGate'
import { api } from '@/lib/api'
import DashboardLayout from './Layout'
import Profile from './Profile'
import History from './History'
import Recordings from './Recordings'
import Feedback from './Feedback'

// The dashboard always opens in a tab, so EntryGate shows Landing → Login first — unless the
// side panel opened it with ?from=app, in which case it goes straight to the routed dashboard.
export default function Dashboard() {
  // EntryGate guarantees a session before children render, so the user resolves
  // quickly; `null` until it does (Profile shows a brief loading state).
  const [user, setUser] = useState(null)
  useEffect(() => {
    api.getCurrentUser().then(setUser)
  }, [])

  return (
    <div className="bg-card h-screen w-full">
      <EntryGate>
        <HashRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<Navigate to="/profile" replace />} />
              <Route path="profile" element={<Profile user={user} />} />
              <Route path="history" element={<History />} />
              <Route path="recordings" element={<Recordings />} />
              <Route path="feedback" element={<Feedback />} />
              <Route path="*" element={<Navigate to="/profile" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </EntryGate>
    </div>
  )
}
