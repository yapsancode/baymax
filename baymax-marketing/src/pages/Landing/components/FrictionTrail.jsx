// FrictionTrail — slide 4's step control: 8 aligned step bars with a vertical
// cognitive-energy meter alongside — the "AI brain fry" made visible. Each
// step drains the meter a little (the two window-switch beats cost the most —
// context switching is the expensive part), sliding teal → amber → red until
// the final step lands on empty. Everything is presenter-driven: clicking a
// bar jumps to that step, and all states derive from `step` so walking
// backward retracts cleanly.

import { motion } from 'framer-motion'
import { ArrowLeftRight, Brain } from 'lucide-react'

// Per-step cognitive cost (sums to 100). Steps 2 and 7 are the window
// switches — the alt-tab tax.
const DRAIN = [4, 20, 6, 10, 12, 13, 20, 15]
const SWITCH_STEPS = [1, 6]

export function FrictionTrail({ steps, step, onStepChange, reducedMotion = false }) {
  const energy = 100 - DRAIN.slice(0, step + 1).reduce((a, b) => a + b, 0)
  const tone = energy > 60 ? 'bg-primary' : energy > 30 ? 'bg-warning' : 'bg-danger'
  const switchBeat = SWITCH_STEPS.includes(step) && !reducedMotion

  return (
    <div>
      {/* Meter header */}
      <div className="flex items-center gap-2">
        <Brain size={14} className={energy > 30 ? 'text-primary' : 'text-danger'} />
        <span className="text-caption text-muted-foreground tracking-[0.14em] uppercase">
          Cognitive energy
        </span>
        <span className="text-caption text-muted-foreground ml-auto font-mono">{energy}%</span>
      </div>

      {/* Vertical meter + step bars — the fill recedes as you descend the steps */}
      <div className="mt-3 flex gap-3">
        <motion.div
          className="bg-muted relative w-1.5 shrink-0 self-stretch overflow-hidden rounded-full"
          animate={switchBeat ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <div
            className={`absolute inset-x-0 bottom-0 rounded-full transition-all duration-500 ${tone}`}
            style={{ height: `${energy}%` }}
          />
        </motion.div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {steps.map((label, i) => {
            const done = i < step
            const current = i === step
            const isSwitch = SWITCH_STEPS.includes(i)
            return (
              <button
                key={label}
                onClick={() => onStepChange(i)}
                aria-pressed={current}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-200 ${
                  current
                    ? 'border-primary bg-primary text-primary-foreground'
                    : done
                      ? 'border-primary/40 text-primary hover:bg-accent'
                      : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="text-caption font-mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-small truncate font-medium">{label}</span>
                {isSwitch && <ArrowLeftRight size={11} className="shrink-0 opacity-70" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Caption */}
      <p
        className={`text-caption mt-3 ${step === steps.length - 1 ? 'text-danger' : 'text-muted-foreground'}`}
      >
        {step === steps.length - 1
          ? "Brain fried — and you still haven't deployed."
          : 'AI brain fry, in real time.'}
      </p>
    </div>
  )
}
