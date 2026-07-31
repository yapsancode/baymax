import { ChevronRight } from 'lucide-react'
import { TaskIcon } from '@/components/shared'

export function TaskSuggestionCard({ task, label, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border bg-card hover:bg-muted flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
    >
      <TaskIcon task={task} />
      <div className="min-w-0 flex-1">
        <p className="text-body text-foreground font-semibold">{label}</p>
        <p className="text-caption text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
    </button>
  )
}
