// Dashboard layout — persistent sidebar + routed content area.
// Tabs are <NavLink>s; the active tab comes from the URL (isActive), and the
// matched page renders into <Outlet>. Add a tab by adding a NAV entry here and
// a <Route> in index.jsx.

import { NavLink, Outlet } from 'react-router-dom'
import { User, Clock, Flag, FolderOpen, LogOut } from 'lucide-react'
import { BaymaxLogo } from '@/components/shared'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUserRole } from '@/lib/useUserRole'

const NAV = [
  { to: '/profile', label: 'Profile', Icon: User },
  { to: '/history', label: 'Task History', Icon: Clock },
]

export default function DashboardLayout() {
  const role = useUserRole()
  const nav = role === 'admin'
    ? [...NAV, { to: '/recordings', label: 'Recordings', Icon: FolderOpen }, { to: '/feedback', label: 'Feedback', Icon: Flag }]
    : NAV

  return (
    <div className="bg-muted flex h-screen">
      <aside className="border-border bg-card flex w-60 flex-col border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <BaymaxLogo size="sm" />
          <span className="text-h2">Baymax</span>
        </div>

        <nav className="flex-1 px-2 py-2">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'text-small flex w-full items-center gap-3 border-l-2 px-4 py-2 transition-colors',
                  isActive
                    ? 'border-primary bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-muted border-transparent',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 p-3">
          {/* signOut clears the token; EntryGate's SIGNED_OUT listener routes back to Login. */}
          <Button variant="outline" className="w-full" onClick={() => api.logout()}>
            <LogOut size={16} />
            Log out
          </Button>
        </div>
      </aside>

      <main className="bg-muted min-w-0 flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
