// Slide 7 (combined) — Features + the tech behind them.
// Six presenter-driven beats, navigated with ↑ / ↓ while ← / → stay with the
// deck. Each beat shows a short feature description on the left and an animated
// mockup on the right, plus a one-line tech caption.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import {
  VisualHighlightMock,
  KnowledgeBaseMock,
  MemoryMock,
  UserRolesMock,
  StepRecorderMock,
  FeedbackLoopMock,
} from '../components/FeatureMocks'

const FEATURES = [
  {
    n: '01',
    title: 'Visual guidance by intent',
    body: 'Baymax highlights the exact element to click by matching its role, name, and context.',
    tech: 'Weighted scoring resolver with confidence thresholds and a text-only fallback.',
    Mock: VisualHighlightMock,
  },
  {
    n: '02',
    title: 'Smart assistant with grounded knowledge',
    body: 'Ask in plain English and get the right guide, not a generic answer.',
    tech: 'RAG over GCP docs + LangChain / Gemini; official guides bypass the LLM.',
    Mock: KnowledgeBaseMock,
  },
  {
    n: '03',
    title: 'Cloud memory',
    body: 'Task progress and history persist across devices.',
    tech: 'Session state stored in Supabase so you can resume anywhere.',
    Mock: MemoryMock,
  },
  {
    n: '04',
    title: 'Role-based access',
    body: 'Two user roles — admins get the tools to create and curate guides.',
    tech: 'Role claim in the JWT; admin-only endpoints gated server-side.',
    Mock: UserRolesMock,
  },
  {
    n: '05',
    title: 'Step recorder',
    body: 'Admins record a workflow once and turn it into a reusable guide.',
    tech: 'Content script captures clicks and fills; FastAPI refines wording; export JSON / PDF.',
    Mock: StepRecorderMock,
  },
    {
      n: '06',
      title: 'Feedback loop',
      body: 'Users flag bad steps with a thumbs-down; our team gets the signal and fixes the guide.',
      tech: 'POST /feedback records failures; the dashboard aggregates them for the team.',
      Mock: FeedbackLoopMock,
    },
]

export default function Slide07Features() {
  const [index, setIndex] = useState(0)

  // ↑ / ↓ walk the features hands-free. Same guards as Slide 4: no modifiers,
  // never while typing.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(FEATURES.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const active = FEATURES[index]
  const ActiveMock = active.Mock

  return (
    <SlideShell>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_3fr]">
        {/* Left: title + feature list */}
        <div>
          <SlideItem>
            <SlideEyebrow>How Baymax works</SlideEyebrow>
            <SlideTitle className="text-3xl sm:text-4xl lg:text-5xl">
              How it&rsquo;s built
            </SlideTitle>
          </SlideItem>

          <SlideItem className="mt-6">
            <div className="space-y-2">
              {FEATURES.map((f, i) => {
                const selected = i === index
                return (
                  <button
                    key={f.n}
                    onClick={() => setIndex(i)}
                    aria-pressed={selected}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="text-h1 leading-none font-semibold">{f.n}</span>
                    <p className="text-small font-medium">{f.title}</p>
                  </button>
                )
              })}
            </div>
          </SlideItem>

          <SlideItem className="mt-4">
            <p className="text-caption text-muted-foreground">
              Use ↑ / ↓ to walk through each feature.
            </p>
          </SlideItem>
        </div>

        {/* Right: mockup */}
        <SlideItem className="flex h-full flex-col">
          <div className="relative flex min-h-[500px] flex-1 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.n}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full"
              >
                <ActiveMock />
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="text-caption text-muted-foreground mt-3">
            <span className="text-primary font-medium">Tech:</span> {active.tech}
          </p>
        </SlideItem>
      </div>
    </SlideShell>
  )
}
