import { cn } from '@/lib/utils'

export function ProgressBar({ current, total, className }) {
  const percent = Math.round((current / total) * 100)
  return (
    <div className={cn('bg-muted h-1 w-full', className)}>
      <div
        className="bg-primary h-full rounded-full transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
