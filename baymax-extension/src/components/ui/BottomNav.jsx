import { MessageCircle, List, Circle, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { withFromApp } from '@/lib/context'
import { useUserRole } from '@/lib/useUserRole'

// Opens the dashboard in its own tab, tagged with ?from=app so it skips the Landing/Login
// (the user is already inside the app here).
function openDashboard() {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: withFromApp(chrome.runtime.getURL('dashboard.html')) })
  } else {
    window.open(withFromApp('/dashboard.html'), '_blank')
  }
}

const TABS = [
  { id: 'ask', label: 'Ask', Icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', Icon: List },
]

export function BottomNav({ activeTab, onTabChange }) {
  const userRole = useUserRole()

  return (
    <nav className="border-border bg-background flex items-stretch border-t">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2 transition-colors',
            activeTab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon size={20} />
          <span className="text-caption">{label}</span>
        </button>
      ))}
      {userRole === 'admin' && (
        <button
          onClick={() => onTabChange('record')}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-2 transition-colors',
            activeTab === 'record' ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Circle size={20} />
          <span className="text-caption">Record</span>
        </button>
      )}
      <button
        onClick={openDashboard}
        className="text-muted-foreground hover:text-foreground flex flex-1 flex-col items-center gap-1 py-2 transition-colors"
      >
        <LayoutDashboard size={20} />
        <span className="text-caption">Dashboard</span>
      </button>
    </nav>
  )
}
