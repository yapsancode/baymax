// The styleguide page. Open at /styleguide.html during `npm run dev`.
// Purpose: every reusable token and component, shown together so the team
// can see what's available before reaching for raw Tailwind utilities.
// When you add a new shared component or token, add it here too.

import { useState } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  ProgressBar,
  Switch,
  TaskStepCard,
} from '@/components/ui'
import {
  BaymaxLogo,
  TaskIcon,
  IdleMascot,
  ThinkMascot,
  WorkMascot,
  HackMascot,
  SuccessMascot,
  ErrorMascot,
} from '@/components/shared'

// The pixel Baymax sprite states, in lifecycle order. Each maps to a moment in
// the app: resting → a call is in flight → doing work → done / failed.
const MASCOTS = [
  ['idle', IdleMascot, 'At rest — side panel open, nothing in flight'],
  ['think', ThinkMascot, 'A Gemini call is streaming (chat / repair)'],
  ['work', WorkMascot, 'Working a step — laptop out, typing'],
  ['hack', HackMascot, 'Digging through the page — self-heal / recording'],
  ['success', SuccessMascot, 'A step or guide finished — confetti'],
  ['error', ErrorMascot, "Couldn't resolve — X eyes, alarm bangs"],
]

const COLORS = [
  ['background', 'bg-background border border-border'],
  ['foreground', 'bg-foreground'],
  ['card', 'bg-card border border-border'],
  ['muted', 'bg-muted'],
  ['muted-foreground', 'bg-muted-foreground'],
  ['border', 'bg-border'],
  ['primary', 'bg-primary'],
  ['accent', 'bg-accent'],
  ['success-soft', 'bg-success-soft'],
  ['warning-soft', 'bg-warning-soft'],
  ['danger-soft', 'bg-danger-soft'],
  ['info-soft', 'bg-info-soft'],
  ['purple', 'bg-purple'],
  ['purple-soft', 'bg-purple-soft'],
]

const TYPE = [
  ['text-display', 'For the rare big moment — e.g. "Backend is live"'],
  ['text-h1', 'Screen title'],
  ['text-h2', 'Section / card title'],
  ['text-body', 'Default paragraph copy'],
  ['text-small', 'Secondary text, descriptions'],
  ['text-caption', 'Labels, badges, timestamps'],
]

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h2 text-foreground">{title}</h2>
        {hint && <p className="text-small text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  )
}

export default function Styleguide() {
  const [toggle, setToggle] = useState(true)
  const [text, setText] = useState('my-app')

  return (
    <div className="bg-muted h-screen overflow-y-auto">
      <header className="bg-card border-border border-b px-8 py-5">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <BaymaxLogo size="md" />
          <div>
            <h1 className="text-h1">Baymax Styleguide</h1>
            <p className="text-small text-muted-foreground">
              Tokens and components used across the extension. Reach for these before writing raw
              Tailwind classes.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-8 py-8">
        <Section
          title="Color tokens"
          hint="Defined in src/index.css under @theme. Use bg-{name}, text-{name}, border-{name}."
        >
          <div className="grid grid-cols-3 gap-3">
            {COLORS.map(([name, swatchClass]) => (
              <div key={name} className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${swatchClass}`} />
                <code className="text-caption text-muted-foreground">{name}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Type scale"
          hint="Semantic names — pick by role, not size. Avoid text-xs/sm/lg unless there's a clear exception."
        >
          <div className="bg-card border-border space-y-2 rounded-xl border p-4">
            {TYPE.map(([cls, role]) => (
              <div key={cls} className="flex items-baseline gap-4">
                <span className={cls}>The quick brown fox</span>
                <code className="text-caption text-muted-foreground ml-auto">{cls}</code>
                <span className="text-caption text-muted-foreground w-44 text-right">{role}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Button"
          hint="4 variants × 3 sizes. Variant defaults to secondary, size to md."
        >
          <div className="bg-card border-border space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">Deploy</Button>
              <Button variant="secondary">Cancel</Button>
              <Button variant="danger">Delete project</Button>
              <Button variant="ghost">Open Dashboard</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary">
                sm
              </Button>
              <Button size="md" variant="primary">
                md
              </Button>
              <Button size="lg" variant="primary">
                lg
              </Button>
            </div>
          </div>
        </Section>

        <Section
          title="Badge"
          hint="Three status variants. Map your status string to one of these."
        >
          <div className="bg-card border-border flex gap-2 rounded-xl border p-4">
            <Badge variant="completed">completed</Badge>
            <Badge variant="active">active</Badge>
            <Badge variant="incomplete">incomplete</Badge>
          </div>
        </Section>

        <Section title="Input">
          <div className="bg-card border-border max-w-sm rounded-xl border p-4">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Project ID"
            />
          </div>
        </Section>

        <Section title="Switch">
          <div className="bg-card border-border flex items-center gap-3 rounded-xl border p-4">
            <Switch checked={toggle} onCheckedChange={setToggle} />
            <span className="text-small">Save setup history</span>
          </div>
        </Section>

        <Section title="ProgressBar">
          <div className="bg-card border-border space-y-3 rounded-xl border p-4">
            <ProgressBar current={2} total={6} />
            <p className="text-caption text-muted-foreground">Step 2 of 6</p>
          </div>
        </Section>

        <Section
          title="Card"
          hint="Card / CardHeader / CardContent. Use CardHeader for titles, CardContent for body."
        >
          <Card className="max-w-md">
            <CardHeader>
              <h3 className="text-h2">Time saved</h3>
            </CardHeader>
            <CardContent>
              <p className="text-display text-primary">~3 hrs</p>
              <p className="text-small text-muted-foreground">across 12 setups this month</p>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="TaskStepCard"
          hint="The Guidance step card. Off-track is informational (info tokens), not an error — danger is reserved for real failures."
        >
          <div className="grid items-start gap-4 md:grid-cols-3">
            {[
              {
                label: 'default',
                props: {
                  canAutomate: true,
                  onShowMe: () => {},
                  onDoItForMe: () => {},
                },
              },
              {
                label: 'off-track',
                props: {
                  offTrack: true,
                  onTakeMeBack: () => {},
                  statusMessage:
                    'You\'ve navigated away from this step\'s page — no rush. "Take me back" (here or on Baymax) jumps you right back to it.',
                },
              },
              {
                label: 'error',
                props: {
                  onShowMe: () => {},
                  statusMessage:
                    "Couldn't find this on the page yet. Navigate there manually, then try again.",
                },
              },
            ].map(({ label, props }) => (
              <div key={label} className="space-y-1">
                <code className="text-caption text-muted-foreground">{label}</code>
                <TaskStepCard
                  stepNumber={3}
                  totalSteps={9}
                  title='Click "Deploy container"'
                  description="Open the deploy form for a new Cloud Run service."
                  {...props}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="TaskIcon"
          hint="Per-task identity colors. Don't use these shades for anything else."
        >
          <div className="bg-card border-border flex gap-4 rounded-xl border p-4">
            {['frontend', 'backend', 'database', 'storage'].map((t) => (
              <div key={t} className="flex flex-col items-center gap-1">
                <TaskIcon task={t} />
                <code className="text-caption text-muted-foreground">{t}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Mascot states"
          hint="Pixel Baymax sprites. Self-contained (transparent bg, styles inject once), size prop drives height, and all motion pauses under prefers-reduced-motion. Swap by app state."
        >
          <div className="bg-card border-border grid grid-cols-2 gap-4 rounded-xl border p-4 md:grid-cols-3">
            {MASCOTS.map(([name, Mascot, role]) => (
              <div
                key={name}
                className="border-border flex flex-col items-center gap-2 rounded-lg border p-4"
              >
                <div className="flex h-32 w-full items-end justify-center rounded-lg bg-[#0b2523] p-3">
                  <Mascot size={112} />
                </div>
                <code className="text-caption text-foreground">{`<${name[0].toUpperCase()}${name.slice(1)}Mascot />`}</code>
                <span className="text-caption text-muted-foreground text-center">{role}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="In context" hint="What these look like used together.">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-h2">Recent activity</h3>
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  task: 'backend',
                  label: 'Hosted a backend',
                  sub: 'Cloud Run · asia-southeast1',
                  status: 'completed',
                },
                {
                  task: 'database',
                  label: 'Set up a database',
                  sub: 'Cloud SQL · PostgreSQL',
                  status: 'active',
                },
                {
                  task: 'frontend',
                  label: 'Host a frontend',
                  sub: 'Firebase Hosting',
                  status: 'incomplete',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <TaskIcon task={row.task} />
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-foreground">{row.label}</p>
                    <p className="text-caption text-muted-foreground truncate">{row.sub}</p>
                  </div>
                  <Badge variant={row.status}>{row.status}</Badge>
                  <ArrowRight size={14} className="text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        <Section title="Service URL row" hint="Used on the Complete screen.">
          <div className="bg-card border-border flex items-center gap-2 rounded-xl border p-4">
            <div className="bg-success-soft flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
              <Check size={14} className="text-success-foreground" />
            </div>
            <code className="text-small text-foreground flex-1 truncate">
              https://my-app-xyz.run.app
            </code>
            <Button variant="ghost" size="sm">
              <Copy size={14} />
            </Button>
          </div>
        </Section>
      </main>
    </div>
  )
}
