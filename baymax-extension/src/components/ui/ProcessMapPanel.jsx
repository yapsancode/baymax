import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProcessMapPanel({ steps = [], defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <div className="border-border bg-card w-72 rounded-lg border shadow-md">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-h2">Process Map</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <Chevron size={18} />
        </button>
      </div>
      {open && (
        <ol className="border-border space-y-3 border-t px-4 py-3">
          {steps.map((step, i) => (
            <Step key={step.id} step={step} index={i} />
          ))}
        </ol>
      )}
    </div>
  )
}

function Step({ step, index }) {
  const { title, status } = step
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'text-caption flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
          status === 'active' && 'bg-primary text-primary-foreground',
          status === 'completed' && 'bg-success-soft text-success-foreground',
          status === 'pending' && 'border-border text-muted-foreground border',
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'text-small',
            status === 'active' && 'text-foreground font-semibold',
            status === 'completed' && 'text-foreground',
            status === 'pending' && 'text-muted-foreground',
          )}
        >
          {title}
        </p>
        {status === 'active' && <p className="text-caption text-primary">CURRENT STEP</p>}
      </div>
    </li>
  )
}
