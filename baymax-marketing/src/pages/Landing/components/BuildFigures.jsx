// BuildFigures — the right-hand visuals for slide 8 ("How we built it").
// One small figure per build topic, rendered inside the slide's panel; the
// slide swaps them as the presenter walks the steps. Loops are gentle and
// respect reduced motion (static fallbacks show the end state).

import { motion } from 'framer-motion'
import { Sparkles, ListOrdered, Wrench, Volume2, ArrowRight, Zap, Menu } from 'lucide-react'
import { BaymaxFace } from '@/components/shared'

const chip = 'bg-muted text-caption text-foreground rounded-md px-2 py-1 whitespace-nowrap'

/* 1 — Smart highlighting: a scan sweeps the wrong buttons, then the ring
      locks onto the one matching the intent. */
function FigureSmartHighlight({ reducedMotion }) {
  // One 3s loop: Cancel scans 0–25%, Learn more 33–58%, Create locks at 66%+.
  const scan = (times) => ({
    animate: { opacity: [0, 1, 0] },
    transition: { duration: 3, repeat: Infinity, times, ease: 'easeInOut' },
  })
  return (
    <div className="mock-gcp flex h-full flex-col p-5 sm:p-6">
      <div className="flex justify-center">
        <span className="border-primary/40 bg-primary/10 text-primary text-caption rounded-full border px-3 py-1 font-mono">
          &ldquo;the blue Create button&rdquo;
        </span>
      </div>

      <div className="bg-muted/50 mt-5 flex-1 rounded-lg p-4">
        <div className="border-border bg-card space-y-3 rounded-lg border p-4">
          <div className="bg-muted h-2.5 w-1/3 rounded-full" />
          <div className="bg-muted h-2.5 w-2/3 rounded-full" />
          <div className="bg-muted h-2.5 w-1/2 rounded-full" />

          <div className="flex items-center gap-3 pt-3">
            {/* Wrong buttons — the scan visits them first */}
            <span className="relative">
              {!reducedMotion && (
                <motion.span
                  className="ring-muted-foreground/60 pointer-events-none absolute -inset-1 rounded-md ring-2"
                  {...scan([0, 0.12, 0.25])}
                />
              )}
              <span className="text-small text-primary font-medium">Cancel</span>
            </span>
            <span className="relative">
              {!reducedMotion && (
                <motion.span
                  className="ring-muted-foreground/60 pointer-events-none absolute -inset-1 rounded-md ring-2"
                  {...scan([0.33, 0.45, 0.58])}
                />
              )}
              <span className="border-border text-small text-foreground rounded-md border px-3 py-1 font-medium">
                Learn more
              </span>
            </span>
            {/* The match — ring locks on and keeps pulsing */}
            <span className="relative">
              <motion.span
                className="ring-ring pointer-events-none absolute -inset-1 rounded-md ring-2"
                animate={
                  reducedMotion ? { opacity: 1 } : { opacity: [0, 0, 1, 0.35, 1, 0.35, 1] }
                }
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 3, repeat: Infinity, times: [0, 0.62, 0.7, 0.78, 0.86, 0.94, 1] }
                }
              />
              <span className="bg-primary text-small text-primary-foreground rounded-md px-3 py-1 font-medium">
                Create
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* 2 — Three AI features: Gemini's three jobs, staggered in. */
const AI_JOBS = [
  {
    icon: ListOrdered,
    title: 'Question → steps',
    body: 'Turns your question into step-by-step instructions.',
  },
  {
    icon: Wrench,
    title: 'Self-healing steps',
    body: 'Fixes steps when a button moves.',
  },
  {
    icon: Volume2,
    title: 'Voice guidance',
    body: 'Reads the steps out loud.',
  },
]

function FigureAiFeatures() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 sm:p-6">
      <div className="mb-1 flex">
        <span className="border-primary/40 bg-primary/10 text-primary text-caption flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono">
          <Sparkles size={11} /> Gemini
        </span>
      </div>
      {AI_JOBS.map(({ icon: Icon, title, body }, i) => (
        <motion.div
          key={title}
          className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3.5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 + i * 0.15, ease: 'easeOut' }}
        >
          <span className="bg-accent text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Icon size={15} />
          </span>
          <span>
            <span className="text-small text-foreground block font-medium">{title}</span>
            <span className="text-caption text-muted-foreground mt-0.5 block">{body}</span>
          </span>
        </motion.div>
      ))}
    </div>
  )
}

/* 3 — Iframes: the button lives two "pages within the page" deep. */
function FigureIframes() {
  return (
    <div className="mock-gcp h-full p-5 sm:p-6">
      <div className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
        <Menu size={13} className="text-muted-foreground" />
        <span className="text-small text-foreground font-medium">Google Cloud</span>
      </div>

      <div className="border-muted-foreground/40 relative mt-4 rounded-lg border-2 border-dashed p-3">
        <span className="bg-background text-caption text-muted-foreground absolute -top-2 left-3 px-1 font-mono">
          iframe
        </span>
        <div className="bg-muted h-2.5 w-1/2 rounded-full" />

        <div className="border-muted-foreground/40 relative mt-3 rounded-lg border-2 border-dashed p-3">
          <span className="bg-background text-caption text-muted-foreground absolute -top-2 left-3 px-1 font-mono">
            iframe
          </span>
          <div className="flex justify-center py-2">
            <span className="relative">
              <span className="ring-ring pointer-events-none absolute -inset-1 rounded-md ring-2" />
              <span className="bg-primary text-small text-primary-foreground rounded-md px-3 py-1 font-medium">
                Create
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* 4 — Safe overlay: Baymax's layer floats above Google's page, never touching it. */
function FigureSafeOverlay({ reducedMotion }) {
  return (
    <div className="flex h-full items-center justify-center p-5 sm:p-6">
      <div className="relative w-full max-w-[340px]">
        {/* Google's page */}
        <div className="mock-gcp border-border bg-card relative rounded-lg border p-4">
          <span className="border-border bg-card text-caption text-muted-foreground absolute -top-2.5 left-3 rounded-full border px-2 py-0.5 font-mono">
            Google&apos;s page
          </span>
          <div className="space-y-2 pt-1">
            <div className="bg-muted h-2.5 w-1/3 rounded-full" />
            <div className="bg-muted h-2.5 w-2/3 rounded-full" />
            <div className="bg-muted h-2.5 w-1/2 rounded-full" />
            <div className="pt-2">
              <span className="bg-primary text-small text-primary-foreground rounded-md px-3 py-1 font-medium">
                Create
              </span>
            </div>
          </div>
        </div>

        {/* Baymax's layer — offset, translucent, its own world */}
        <motion.div
          className="border-primary/50 bg-primary/5 absolute inset-0 rounded-lg border backdrop-blur-[1px]"
          initial={false}
          animate={reducedMotion ? { y: -10, x: 10 } : { y: [-10, -14, -10], x: 10 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="border-primary/50 bg-card text-primary text-caption absolute -right-3 -bottom-2.5 rounded-full border px-2 py-0.5 font-mono">
            Baymax layer
          </span>
          {/* Its highlight box + mascot, drawn on the layer, not the page */}
          <span className="border-primary/70 absolute bottom-4 left-4 h-7 w-20 rounded-md border-2 border-dashed" />
          <span className="absolute right-3 bottom-3">
            <BaymaxFace size={24} />
          </span>
        </motion.div>
      </div>
    </div>
  )
}

/* 5 — Skip the AI when possible: the recipe fast-lane vs the Gemini lane. */
function FigureSkipAi() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-5 sm:p-6">
      {/* Fast lane — known recipe, no AI */}
      <div className="border-primary/50 bg-primary/5 flex flex-wrap items-center gap-2 rounded-lg border p-3.5">
        <span className={chip}>Deploy to Cloud Run</span>
        <ArrowRight size={13} className="text-muted-foreground shrink-0" />
        <span className={`${chip} font-mono`}>known recipe</span>
        <ArrowRight size={13} className="text-muted-foreground shrink-0" />
        <span className={chip}>steps</span>
        <span className="text-primary text-caption ml-auto flex items-center gap-1 font-mono">
          <Zap size={11} /> AI skipped
        </span>
      </div>

      {/* AI lane — only for new ground */}
      <div className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3.5 opacity-70">
        <span className={chip}>Something new</span>
        <ArrowRight size={13} className="text-muted-foreground shrink-0" />
        <span className={`${chip} flex items-center gap-1`}>
          <Sparkles size={11} className="text-primary" /> Gemini
        </span>
        <ArrowRight size={13} className="text-muted-foreground shrink-0" />
        <span className={chip}>steps</span>
      </div>
    </div>
  )
}

const FIGURES = [
  FigureSmartHighlight,
  FigureAiFeatures,
  FigureIframes,
  FigureSafeOverlay,
  FigureSkipAi,
]

export function BuildFigure({ step, reducedMotion = false }) {
  const Figure = FIGURES[step] ?? FIGURES[0]
  return <Figure reducedMotion={reducedMotion} />
}
