import { useEffect, useRef, useState } from 'react'
import { FilePlus, Settings, LogOut, Sun, Moon, Monitor, Eye, EyeOff } from 'lucide-react'
import { BaymaxLogo } from '@/components/shared'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

// `pageShare` (boolean) shows the page-aware toggle icon; `null` hides it (off
// the chat screens, or outside the extension). When on, chat attaches a summary
// + screenshot of the current Console tab so Baymax can answer about it.
export function AppHeader({ onNewTask, pageShare = null, onTogglePageShare }) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(null)
  const menuRef = useRef(null)
  const { theme, setTheme } = useTheme()
  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  useEffect(() => {
    api.getCurrentUser().then(setUser)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const iconBtn =
    'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <header className="border-border bg-background flex items-center justify-between border-b px-4 py-2.5">
      <div className="flex items-center gap-2">
        <BaymaxLogo size="sm" />
        <p className="text-h2">Baymax</p>
      </div>
      <div className="flex items-center gap-1">
        {pageShare !== null && (
          <button
            onClick={() => onTogglePageShare?.(!pageShare)}
            aria-pressed={pageShare}
            aria-label={pageShare ? 'Baymax can see this page' : 'Page hidden from Baymax'}
            title={
              pageShare
                ? 'Baymax can see this page — reading the current Cloud Console page (and a screenshot) to answer. Click to hide it.'
                : 'Page hidden — Baymax answers without seeing your screen. Click to let it read the current Cloud Console page.'
            }
            className={cn(iconBtn, pageShare && 'bg-primary/10 text-primary hover:text-primary')}
          >
            {pageShare ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
        {onNewTask && (
          <button onClick={onNewTask} className={iconBtn}>
            <FilePlus size={18} />
          </button>
        )}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setOpen((v) => !v)} className={iconBtn}>
            <Settings size={18} />
          </button>
          {open && (
            <div className="border-border bg-card absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border p-3 shadow-lg">
              {user && (
                <div className="border-border mb-3 border-b pb-3">
                  <p className="text-small text-foreground truncate font-medium">{user.name}</p>
                  <p className="text-caption text-muted-foreground truncate">{user.email}</p>
                </div>
              )}
              <div className="mb-3 border-b border-border pb-3">
                <p className="mb-1.5 px-2 text-caption text-muted-foreground">Theme</p>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1">
                  {themes.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground',
                        theme === value && 'bg-card text-primary shadow-sm',
                      )}
                      aria-label={`${label} theme`}
                      title={label}
                      aria-pressed={theme === value}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setOpen(false)
                  api.logout()
                }}
                className="text-small text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
