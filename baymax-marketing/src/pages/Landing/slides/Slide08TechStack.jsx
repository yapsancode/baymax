// Slide 8 — How we built it. Five engineering decisions as a bento grid:
// Smart Highlighting (wide, with a live mini mock), Gemini's three jobs, then
// iframe search, the safe overlay, and the skip-AI-when-possible rule. A slim
// stack-pill footer keeps the original "built with" info.

import { motion } from 'framer-motion'
import {
  Crosshair,
  Sparkles,
  ListOrdered,
  Wrench,
  Volume2,
  PictureInPicture2,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'

const STACK = ['Vite + React', 'FastAPI', 'LangChain', 'Gemini', 'Supabase']

const AI_JOBS = [
  { icon: ListOrdered, label: 'Turns your question into step-by-step instructions' },
  { icon: Wrench, label: 'Fixes steps when a button moves' },
  { icon: Volume2, label: 'Reads the steps out loud' },
]

function Card({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`border-border bg-card rounded-xl border p-5 text-left ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className="bg-accent text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Icon size={15} />
        </span>
        <h3 className="text-h1">{title}</h3>
      </div>
      <div className="text-small text-muted-foreground mt-3">{children}</div>
    </div>
  )
}

export default function Slide08TechStack() {
  return (
    <SlideShell center>
      <SlideItem>
        <SlideEyebrow>Under the hood</SlideEyebrow>
        <SlideTitle className="text-3xl sm:text-4xl lg:text-5xl">
          How we <span className="text-primary">built</span> it.
        </SlideTitle>
      </SlideItem>

      <div className="mt-8 grid gap-3 text-left lg:grid-cols-6">
        {/* Smart highlighting — wide, with a live mini mock */}
        <SlideItem className="lg:col-span-4">
          <Card icon={Crosshair} title="Smart highlighting" className="flex h-full flex-col">
            <div className="flex flex-1 items-center gap-6">
              <p className="flex-1">
                We tell Baymax <span className="text-foreground">what</span> to find — like
                &ldquo;the blue Create button&rdquo; — not exactly where it is. It checks every
                button on the page and picks the best match; if it can&apos;t, it shows the text
                instead of pointing at the wrong thing.
              </p>
              {/* Mini mock: the intent ("Create") found and ringed */}
              <div className="relative hidden shrink-0 md:block">
                <motion.span
                  className="ring-ring pointer-events-none absolute -inset-1.5 rounded-lg ring-2"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="bg-primary text-small text-primary-foreground rounded-lg px-4 py-1.5 font-medium">
                  Create
                </span>
              </div>
            </div>
          </Card>
        </SlideItem>

        {/* Three AI features */}
        <SlideItem className="lg:col-span-2">
          <Card icon={Sparkles} title="Three AI features" className="h-full">
            <p>Gemini does three jobs:</p>
            <ul className="mt-2 space-y-2">
              {AI_JOBS.map(({ icon: JobIcon, label }) => (
                <li key={label} className="flex items-start gap-2">
                  <JobIcon size={13} className="text-primary mt-0.5 shrink-0" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </SlideItem>

        {/* Iframes */}
        <SlideItem className="lg:col-span-2">
          <Card icon={PictureInPicture2} title="Finding buttons inside the page" className="h-full">
            Google Cloud hides parts of the page inside a &ldquo;page within a page&rdquo; (an
            iframe). Baymax searches all of them, so it always finds the right button.
          </Card>
        </SlideItem>

        {/* Safe overlay */}
        <SlideItem className="lg:col-span-2">
          <Card icon={ShieldCheck} title="Safe overlay" className="h-full">
            Baymax draws its own boxes and mascot on top of the page, kept separate from
            Google&apos;s design — so the two never break each other.
          </Card>
        </SlideItem>

        {/* Skip AI when possible */}
        <SlideItem className="lg:col-span-2">
          <Card icon={Zap} title="Only use AI when needed" className="h-full">
            For common tasks, Baymax already knows the steps and skips the AI — faster, cheaper, and
            more reliable.
          </Card>
        </SlideItem>
      </div>

      {/* Stack footer */}
      <SlideItem className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {STACK.map((tech) => (
          <span
            key={tech}
            className="border-border bg-card text-caption text-muted-foreground rounded-full border px-3 py-1 font-mono"
          >
            {tech}
          </span>
        ))}
      </SlideItem>
    </SlideShell>
  )
}
