import { Globe, Server, Database, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

// Task category colors live here only. They're categorical (task identity),
// not semantic (status). Don't reuse these shades elsewhere — use the
// semantic tokens (primary / info / warning / danger) for status & actions.
const APPEARANCE = {
  frontend: { Icon: Globe, icon: 'text-info', bg: 'bg-info-soft' },
  backend: { Icon: Server, icon: 'text-primary', bg: 'bg-accent' },
  database: { Icon: Database, icon: 'text-purple', bg: 'bg-purple-soft' },
  storage: { Icon: HardDrive, icon: 'text-warning', bg: 'bg-warning-soft' },
}

export function TaskIcon({ task, className, size = 16 }) {
  const { Icon, icon, bg } = APPEARANCE[task] ?? APPEARANCE.frontend
  return (
    <div
      className={cn(
        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
        bg,
        className,
      )}
    >
      <Icon size={size} className={icon} />
    </div>
  )
}
