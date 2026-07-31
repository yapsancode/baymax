// FeatureMocks — six animated mini-illustrations for the combined Slide 7.
// Each mock is a pure visual prop; no API calls, no extension APIs, no state
// shared outside the component.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Check,
  X,
  Circle,
  MousePointerClick,
  Keyboard,
  Download,
  FileText,
  User,
  Shield,
  ThumbsDown,
  Wrench,
  Tags,
  CheckCircle,
} from 'lucide-react'
import { BrowserChrome } from './BrowserChrome'
import { Button } from '@/components/ui'

// Shared mock guide used by the knowledge-base mock.
const MOCK_GUIDE = {
  id: 'cloud-run-deploy',
  title: 'Deploy to Cloud Run',
  steps: [
    { id: 1, title: 'Open Cloud Run create service' },
    { id: 2, title: 'Enter service name' },
    { id: 3, title: 'Select region' },
    { id: 4, title: 'Allow unauthenticated invocations' },
    { id: 5, title: 'Click Deploy' },
  ],
}

// 01 — Visual guidance by intent, with a single-button scoring demo + fallback.
export function VisualHighlightMock() {
  const [phase, setPhase] = useState('match')

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p === 'match' ? 'fallback' : 'match'))
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center">
      <BrowserChrome
        url="console.cloud.google.com/run/deploy"
        className="mock-gcp w-full max-h-full"
        bodyClassName="p-5"
      >
        <div className="space-y-2.5">
          <div className="bg-muted h-3.5 w-1/3 rounded-full" />
          <div className="bg-muted h-3.5 w-2/3 rounded-full" />
          <div className="bg-muted h-3.5 w-1/2 rounded-full" />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              <motion.span
                className="ring-ring pointer-events-none absolute -inset-1.5 rounded-lg ring-2"
                animate={{ opacity: phase === 'match' ? [0.35, 1, 0.35] : 0 }}
                transition={{
                  duration: 1.4,
                  repeat: phase === 'match' ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              />
              <span className="bg-primary text-primary-foreground rounded-lg px-8 py-3 text-small font-semibold">
                Deploy
              </span>
            </div>
            <ScoreCard phase={phase} />
          </div>

          <motion.div
            className="landing bg-card border-border rounded-lg border p-4 shadow-xl"
            animate={{
              opacity: phase === 'fallback' ? 1 : 0,
              y: phase === 'fallback' ? 0 : 8,
            }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-caption text-foreground font-medium">
              Couldn&apos;t confidently point to the button.
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              Look for the button labeled &ldquo;Deploy&rdquo;.
            </p>
          </motion.div>
        </div>
      </BrowserChrome>
    </div>
  )
}

function ScoreCard({ phase }) {
  const factors = [
    { label: 'Accessible name', value: 'Deploy', ok: phase === 'match' },
    { label: 'ARIA role', value: 'button', ok: phase === 'match' },
    { label: 'Context', value: 'Cloud Run form', ok: phase === 'match' },
  ]

  return (
    <div className="landing bg-card border-border w-60 rounded-lg border p-4 shadow-xl">
      <p className="text-caption text-muted-foreground mb-2.5 font-medium">Match factors</p>
      <div className="space-y-1.5">
        {factors.map((f, i) => (
          <motion.div
            key={f.label}
            className="text-small flex items-center gap-2"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
          >
            {f.ok ? (
              <Check size={14} className="text-success" />
            ) : (
              <X size={14} className="text-danger" />
            )}
            <span className="text-muted-foreground">{f.label}:</span>
            <span className="text-foreground">{f.value}</span>
          </motion.div>
        ))}
      </div>
      <motion.p
        className="text-caption text-success mt-3 font-medium"
        animate={{ opacity: phase === 'match' ? 1 : 0 }}
      >
        High confidence match
      </motion.p>
      <motion.p
        className="text-caption text-danger mt-3 font-medium"
        animate={{ opacity: phase === 'fallback' ? 1 : 0 }}
      >
        Below threshold → text guidance
      </motion.p>
    </div>
  )
}

// 02 — Smart assistant / RAG: a GCP docs page section is extracted into a guide.
export function KnowledgeBaseMock() {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center gap-0">
      {/* GCP Docs page — vertical/portrait proportion */}
      <div className="mock-gcp border-border bg-card w-48 shrink-0 rounded-lg border p-4 shadow-lg">
        {/* Docs header */}
        <div className="flex items-center gap-1.5">
          <span className="bg-primary h-1.5 w-1.5 rounded-full" />
          <span className="text-caption text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
            GCP Docs
          </span>
        </div>

        {/* Breadcrumb */}
        <div className="bg-muted mt-3 h-2.5 w-4/5 rounded-full" />
        <div className="bg-muted mt-1 h-2 w-1/3 rounded-full" />

        {/* Title */}
        <div className="bg-foreground/80 mt-4 h-4 w-3/4 rounded-full" />
        <div className="bg-foreground/50 mt-1.5 h-3 w-1/2 rounded-full" />

        {/* Body intro */}
        <div className="mt-4 space-y-1.5">
          <div className="bg-muted h-2.5 w-full rounded-full" />
          <div className="bg-muted h-2.5 w-4/5 rounded-full" />
        </div>

        {/* Highlighted steps section */}
        <motion.div
          className="border-primary/40 bg-primary/5 mt-3 space-y-2 rounded-lg border p-3"
          animate={{
            borderColor: [
              'rgba(26, 115, 232, 0.2)',
              'rgba(26, 115, 232, 0.7)',
              'rgba(26, 115, 232, 0.2)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {[2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <span className="bg-primary/15 text-caption text-primary flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold">
                {n}
              </span>
              <div className="bg-muted h-2.5 flex-1 rounded-full" />
            </div>
          ))}
        </motion.div>

        {/* Code snippet hint */}
        <div className="bg-muted/70 mt-3 space-y-1 rounded-md px-3 py-2">
          <div className="bg-foreground/30 h-2 w-3/4 rounded-full" />
          <div className="bg-foreground/20 h-2 w-1/2 rounded-full" />
        </div>

        {/* Footer link */}
        <div className="bg-primary/10 mt-3 h-2.5 w-3/5 rounded-full" />
      </div>

      {/* Animated connecting arrow */}
      <div className="flex w-16 shrink-0 items-center justify-center -mx-1">
        <motion.svg
          width="64"
          height="24"
          viewBox="0 0 64 24"
          className="text-primary overflow-visible"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.path
            d="M 0 12 L 56 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          />
          <motion.polygon
            points="50,6 60,12 50,18"
            fill="currentColor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          />
        </motion.svg>
      </div>

      {/* Extracted guide — horizontal/landscape proportion */}
      <motion.div
        className="border-border bg-card w-72 shrink-0 rounded-lg border p-4"
        initial={{ opacity: 0, x: 30, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <p className="text-caption text-muted-foreground">Extracted guide · 5 steps</p>
        <p className="text-h1 mt-1">{MOCK_GUIDE.title}</p>
        <ol className="mt-3 space-y-1.5">
          {MOCK_GUIDE.steps.map((s, i) => (
            <li key={s.id} className="text-small flex items-start gap-2">
              <span className="text-caption text-muted-foreground w-5 text-right tabular-nums">
                {i + 1}.
              </span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
        <Button className="mt-4 w-full">Start Guided Session</Button>
      </motion.div>
    </div>
  )
}

// 03 — Cloud memory: session tasks stored in the database, ready to resume.
export function MemoryMock() {
  const sessionTasks = [
    { title: 'Deploy Cloud Run', progress: 40, status: 'In Progress' },
    { title: 'Set up VPC', progress: 100, status: 'Completed' },
    { title: 'Configure IAM', progress: 65, status: 'In Progress' },
  ]

  return (
    <div className="flex h-full items-center justify-center py-6">
      <div className="flex items-center gap-0">
        <motion.div
          className="bg-primary/10 flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Database size={52} className="text-primary" />
        </motion.div>

        <svg
          className="h-full max-h-[300px] w-16 shrink-0 self-center text-muted-foreground/40"
          viewBox="0 0 64 100"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="50" x2="24" y2="50" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="24" y1="20" x2="24" y2="80" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="24" y1="20" x2="64" y2="20" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="24" y1="50" x2="64" y2="50" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <line x1="24" y1="80" x2="64" y2="80" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>

        <div className="flex flex-col gap-6">
          {sessionTasks.map((t, i) => (
            <motion.div
              key={t.title}
              className="border-border bg-card w-80 rounded-lg border p-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + 0.15 * i, duration: 0.35 }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-body font-medium truncate">{t.title}</p>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                  t.status === 'Completed'
                    ? 'bg-success/10 text-success'
                    : t.status === 'In Progress'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {t.status}
                </span>
              </div>
              <div className="bg-muted mt-2 h-2.5 rounded-full">
                <motion.div
                  className="bg-primary h-2.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${t.progress}%` }}
                  transition={{ delay: 0.3 + 0.15 * i, duration: 0.5 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 04 — User roles: two profile icons with capability cards.
export function UserRolesMock() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-8 px-4 py-4">
      <div className="flex flex-1 flex-col items-center gap-5">
        <motion.div
          className="bg-muted flex h-40 w-40 items-center justify-center rounded-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <User size={64} className="text-white" />
        </motion.div>
        <p className="text-h1 font-semibold">User</p>
        <motion.div
          className="border-border bg-card w-full max-w-[320px] rounded-lg border p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-3">
            {['Step-by-step guidance', 'Session history', 'Resume saved tasks'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="bg-primary flex h-2 w-2 shrink-0 rounded-full" />
                <p className="text-body text-white">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5">
        <motion.div
          className="bg-primary/10 relative flex h-40 w-40 items-center justify-center rounded-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Shield size={64} className="text-primary" />
          <motion.span
            className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            A
          </motion.span>
        </motion.div>
        <p className="text-h1 font-semibold">Admin</p>
        <motion.div
          className="border-border bg-card w-full max-w-[320px] rounded-lg border p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="space-y-3">
            {['Record & edit guides', 'Review user feedback', 'Manage RAG knowledge'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="bg-primary flex h-2 w-2 shrink-0 rounded-full" />
                <p className="text-body text-white">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// 05 — Step recorder: a live cursor clicks through a workflow, populating the
// captured-steps list one item at a time. The sequence loops continuously.
export function StepRecorderMock() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 1) % 4)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  const steps = [
    { icon: MousePointerClick, label: 'Click "Create service"' },
    { icon: Keyboard, label: 'Type service name' },
    { icon: MousePointerClick, label: 'Click "Deploy"' },
  ]

  const cursorTarget = [
    { top: '27%', left: '32%' },
    { top: '56%', left: '34%' },
    { top: '80%', left: '44%' },
  ]

  const cursorPos =
    phase === 0
      ? { top: cursorTarget[0].top, left: cursorTarget[0].left, opacity: 0 }
      : { top: cursorTarget[phase - 1].top, left: cursorTarget[phase - 1].left, opacity: 1 }

  return (
    <div className="flex h-full min-h-[360px] gap-3">
      <BrowserChrome
        url="console.cloud.google.com/run/deploy"
        className="mock-gcp flex-1"
        bodyClassName="p-4 relative overflow-hidden"
      >
        <div className="border-danger/40 bg-danger-soft text-caption text-danger flex w-fit items-center gap-2 rounded-lg border px-2 py-1">
          <Circle size={10} className="fill-danger animate-pulse" /> Recording
        </div>

        <div className="mt-5 space-y-2">
          <div className="bg-muted h-4 w-1/3 rounded-full" />
          <div className="bg-muted mt-2 h-3 w-full rounded-full" />
          <div className="bg-muted mt-1.5 h-3 w-4/5 rounded-full" />
        </div>

        {/* Target 1 — Create service */}
        <motion.div
          className="border-border/60 mt-6 rounded-lg border-2 border-dashed px-4 py-3"
          animate={{
            borderColor: phase >= 1 ? 'rgba(0, 229, 160, 0.5)' : 'transparent',
            backgroundColor: phase >= 1 ? 'rgba(0, 229, 160, 0.05)' : 'transparent',
          }}
        >
          <span className="text-small flex items-center gap-2 font-medium text-black">
            <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded text-xs font-bold">
              +
            </span>
            Create service
          </span>
        </motion.div>

        {/* Target 2 — Input field */}
        <motion.div
          className="border-border/60 relative mt-5 rounded-md border px-3 py-2.5"
          animate={{
            borderColor: phase >= 2 ? 'rgba(0, 229, 160, 0.5)' : undefined,
            boxShadow: phase >= 2 ? 'inset 0 0 0 1px rgba(0, 229, 160, 0.2)' : undefined,
          }}
        >
          {phase < 2 && (
            <span className="text-small text-black">Enter service name...</span>
          )}
          {phase >= 2 && (
            <motion.span
              className="text-small flex items-center gap-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              my-cloud-run-service
              <motion.span
                className="bg-foreground/60 inline-block h-4 w-[2px]"
                animate={{ opacity: [0, 1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </motion.span>
          )}
        </motion.div>

        {/* Target 3 — Deploy */}
        <div className="mt-8 flex justify-center">
          <motion.span
            className="bg-primary text-primary-foreground relative rounded-lg px-6 py-2.5 font-medium"
            animate={{
              scale: phase >= 3 ? [1, 1.06, 1] : 1,
              boxShadow: phase >= 3
                ? '0 0 0 3px rgba(0, 229, 160, 0.25)'
                : '0 0 0 0px transparent',
            }}
            transition={{ duration: 0.35 }}
          >
            Deploy
          </motion.span>
        </div>

        {/* Animated cursor */}
        <motion.div
          className="pointer-events-none absolute z-20"
          animate={cursorPos}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        >
          <svg
            width="14"
            height="20"
            viewBox="0 0 14 20"
            className="text-foreground drop-shadow-md"
          >
            <polygon
              points="1,1 1,17 5,13 8,18 10,17 7,12 13,12"
              fill="currentColor"
            />
          </svg>
        </motion.div>
      </BrowserChrome>

      <motion.div
        className="landing border-border bg-card flex w-56 flex-col rounded-lg border p-3 shadow-xl"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-h2">Captured steps</p>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <motion.li
              key={s.label}
              className="text-small flex items-center gap-2"
              animate={{
                opacity: phase > i ? 1 : 0.2,
                x: 0,
              }}
              transition={{ duration: 0.3, delay: phase > i ? 0.15 : 0 }}
            >
              <s.icon
                size={12}
                className={phase > i ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className={phase > i ? 'text-foreground' : 'text-muted-foreground'}>
                {s.label}
              </span>
            </motion.li>
          ))}
        </ol>
        <div className="mt-auto flex gap-2">
          <Button variant="outline" size="sm">
            <Download size={12} /> JSON
          </Button>
          <Button variant="outline" size="sm">
            <FileText size={12} /> PDF
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

// 06 — Closed-loop feedback: four stages in a circular flow around a center label.
export function FeedbackLoopMock() {
  const cards = [
    {
      position: { x: 145, y: 30 },
      icon: <ThumbsDown size={22} className="text-danger" />,
      title: 'Gather',
      subtitle: 'User thumbs-down',
    },
    {
      position: { x: 280, y: 183 },
      icon: <Tags size={22} className="text-primary" />,
      title: 'Categorize',
      subtitle: 'Tag by guide & topic',
    },
    {
      position: { x: 145, y: 335 },
      icon: <Wrench size={22} className="text-primary" />,
      title: 'Act & Follow-Up',
      subtitle: 'Admin updates guide',
    },
    {
      position: { x: 10, y: 183 },
      icon: <CheckCircle size={22} className="text-primary" />,
      title: 'Update',
      subtitle: 'Improved guide live',
    },
  ]

  return (
    <div className="flex h-full min-h-[460px] items-center justify-center p-4">
      <svg
        className="h-full max-h-[460px] w-full max-w-[460px]"
        viewBox="0 0 460 460"
      >
        <defs>
          <marker
            id="loopArrowhead"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L0,12 L10,6 Z" fill="white" />
          </marker>
        </defs>

        {/* Clockwise curved arrows — rounded rectangle around the cards */}
        <path
          d="M 270 77.5 C 365 77.5 365 77.5 365 183"
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#loopArrowhead)"
        />
        <path
          d="M 365 278 C 365 382.5 365 382.5 270 382.5"
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#loopArrowhead)"
        />
        <path
          d="M 145 382.5 C 95 382.5 95 382.5 95 278"
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#loopArrowhead)"
        />
        <path
          d="M 95 183 C 95 77.5 95 77.5 145 77.5"
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          markerEnd="url(#loopArrowhead)"
        />

        {/* Stage cards */}
        {cards.map((card) => (
          <foreignObject
            key={card.title}
            x={card.position.x}
            y={card.position.y}
            width="170"
            height="95"
          >
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-white/20 bg-white p-3 text-center shadow-sm">
              {card.icon}
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {card.title}
              </p>
              <p className="whitespace-nowrap text-xs text-gray-600">
                {card.subtitle}
              </p>
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  )
}
