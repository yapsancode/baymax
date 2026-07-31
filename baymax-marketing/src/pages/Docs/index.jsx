import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Cloud,
  Database,
  FileJson,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Mic,
  MousePointer2,
  Palette,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wrench,
} from 'lucide-react'
import { LandingSiteNav, useLandingScroll } from '@/components/shared'

const CONTENTS = [
  ['overview', 'Overview'],
  ['getting-started', 'Getting started'],
  ['guided-tasks', 'Guided tasks'],
  ['ask-baymax', 'Ask Baymax'],
  ['tasks', 'Tasks and progress'],
  ['recorder', 'Guide recorder'],
  ['dashboard', 'Dashboard and settings'],
  ['troubleshooting', 'Troubleshooting'],
]

const START_STEPS = [
  ['Sign in', 'Open Baymax from the Chrome side panel and sign in or create an account.'],
  [
    'Prepare Google Cloud',
    'Open the Cloud Console, select a project, enable billing, and keep the console language set to English.',
  ],
  [
    'Choose a task',
    'Use a quick-start suggestion or ask Baymax for the deployment you want to complete.',
  ],
  [
    'Start the guide',
    'Review the matched guide, clear the prerequisite check, then follow Baymax in the Cloud Console.',
  ],
]

const GUIDE_TOOLS = [
  {
    icon: MousePointer2,
    title: 'Show me',
    text: 'Highlights the exact control in the active Cloud Console tab and places Baymax beside it.',
  },
  {
    icon: Sparkles,
    title: 'Do it for me',
    text: 'Performs supported click or fill actions. Final submissions are verified before the guide advances.',
  },
  {
    icon: Volume2,
    title: 'Voice guidance',
    text: 'Reads instructions aloud. Toggle narration from the current step card whenever speech is supported.',
  },
  {
    icon: MessageCircle,
    title: 'Ask a follow-up',
    text: 'Ask about the current step without leaving the guide; Baymax includes the active step as context.',
  },
]

const TROUBLESHOOTING = [
  [
    'Baymax cannot find the Cloud Console',
    'Keep console.cloud.google.com open in the same browser window. Use “Open the Cloud Console” when it appears.',
  ],
  [
    'The console is open but cannot be reached',
    'Reload the Cloud Console tab. Tabs opened before the extension loaded may not have the required content script.',
  ],
  [
    'The highlighted control is missing',
    'Confirm you are on the expected page and that the console language is English. Use “Take me back” or the destination shortcut when offered.',
  ],
  [
    'The guide does not advance',
    'Complete the highlighted click or field entry. For a rejected create action, fix the errors shown by Google Cloud and submit again.',
  ],
  [
    'Voice is unavailable',
    'Voice depends on browser speech support and the TTS service. You can continue every guide with on-screen instructions.',
  ],
  [
    'The backend is unavailable',
    'Quick-start tasks can offer an older built-in offline guide. Chat, account data, and saved progress require the backend.',
  ],
]

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="border-border scroll-mt-28 border-b py-14 first:pt-0 last:border-0">
      <p className="text-caption text-primary font-medium tracking-[0.16em] uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {children}
    </section>
  )
}

function FeatureCard({ icon: Icon, title, children }) {
  return (
    <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
      <div className="bg-accent text-primary flex h-9 w-9 items-center justify-center rounded-lg">
        <Icon size={18} />
      </div>
      <h3 className="text-h1 mt-4">{title}</h3>
      <div className="text-small text-muted-foreground mt-2 leading-6">{children}</div>
    </div>
  )
}

export default function DocsPage() {
  const navigate = useNavigate()
  const { hidden, onScroll } = useLandingScroll()

  return (
    <div
      className="landing bg-background text-foreground h-screen w-full overflow-y-auto scroll-smooth"
      onScroll={onScroll}
    >
      <LandingSiteNav hidden={hidden} onGetStarted={() => navigate('/')} />

      <header className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:pt-24">
        <div className="max-w-3xl">
          <div className="border-border bg-card text-caption text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <BookMarkIcon /> Baymax documentation
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Deploy to Google Cloud with a guide beside you.
          </h1>
          <p className="text-body text-muted-foreground mt-5 max-w-2xl leading-7">
            Learn how Baymax finds tested deployment guides, points to the right controls in Google
            Cloud, tracks your progress, and helps you create reusable workflows.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-small text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-opacity hover:opacity-90"
            >
              Open Baymax <ArrowRight size={15} />
            </button>
            <a
              href="#getting-started"
              className="border-border bg-card text-small hover:bg-muted rounded-lg border px-4 py-2.5 font-medium transition-colors"
            >
              Read the quick start
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-24 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="border-border bg-card sticky top-28 rounded-xl border p-3">
            <p className="text-caption text-foreground px-3 pb-2 font-medium">On this page</p>
            {CONTENTS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-small text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Section id="overview" eyebrow="Overview" title="What Baymax does">
            <p className="text-body text-muted-foreground mt-4 max-w-3xl leading-7">
              Baymax is a Chrome side-panel assistant for Google Cloud. It combines conversational
              help with tested, interactive guides that run alongside the real Cloud Console.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureCard icon={Bot} title="Understand the task">
                Ask GCP questions or describe what you want to deploy in natural language.
              </FeatureCard>
              <FeatureCard icon={MousePointer2} title="Guide the real work">
                Baymax navigates, highlights, and observes controls on console.cloud.google.com.
              </FeatureCard>
              <FeatureCard icon={ListChecks} title="Remember progress">
                Signed-in sessions preserve completed steps and can be resumed later.
              </FeatureCard>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="bg-accent text-caption text-accent-foreground rounded-full px-3 py-1">
                <Cloud size={13} className="mr-1 inline" /> Cloud Run
              </span>
              <span className="bg-purple-soft text-caption text-purple rounded-full px-3 py-1">
                <Database size={13} className="mr-1 inline" /> Cloud SQL for PostgreSQL
              </span>
              <span className="bg-muted text-caption text-muted-foreground rounded-full px-3 py-1">
                More tested guides can be added by administrators
              </span>
            </div>
          </Section>

          <Section
            id="getting-started"
            eyebrow="Quick start"
            title="Run your first guided deployment"
          >
            <div className="mt-8 space-y-4">
              {START_STEPS.map(([title, text], index) => (
                <div key={title} className="border-border bg-card flex gap-4 rounded-xl border p-5">
                  <span className="bg-primary text-small text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-h1">{title}</h3>
                    <p className="text-small text-muted-foreground mt-1 leading-6">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-warning/30 bg-warning-soft text-small text-warning-foreground mt-5 flex gap-3 rounded-xl border p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" /> Baymax matches Cloud Console
              controls by their English labels. Other console languages can prevent highlighting and
              automation.
            </div>
          </Section>

          <Section id="guided-tasks" eyebrow="Core workflow" title="How guided tasks work">
            <p className="text-body text-muted-foreground mt-4 leading-7">
              Before a guide starts, Baymax checks for a selected project, an open console tab, and
              English language settings. Billing is a guided confirmation because it cannot be
              verified automatically.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {GUIDE_TOOLS.map(({ icon, title, text }) => (
                <FeatureCard key={title} icon={icon} title={title}>
                  {text}
                </FeatureCard>
              ))}
            </div>
            <div className="border-border bg-muted/40 mt-6 rounded-xl border p-5">
              <h3 className="text-h1 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-success" /> Automatic progress
              </h3>
              <p className="text-small text-muted-foreground mt-2 leading-6">
                A step completes when you click or fill the highlighted control, or when the Cloud
                Console reaches the expected URL. If you navigate away, “Take me back” returns to
                the correct page. Completion opens a summary with next steps.
              </p>
            </div>
          </Section>

          <Section id="ask-baymax" eyebrow="Ask" title="Chat with a GCP assistant">
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <FeatureCard icon={MessageCircle} title="Conversational answers">
                Responses stream into the chat and retain recent conversation context for follow-up
                questions.
              </FeatureCard>
              <FeatureCard icon={Sparkles} title="Tested guide matching">
                Deployment requests are semantically matched against saved guides. If no tested
                guide matches, Baymax gives a helpful text explanation instead of inventing console
                selectors.
              </FeatureCard>
              <FeatureCard icon={Mic} title="Voice input">
                Use the microphone button when browser speech recognition is available, or type into
                the same input.
              </FeatureCard>
              <FeatureCard icon={Play} title="Quick starts">
                Launch Cloud Run or Cloud SQL from the suggestion chips, then review the guide card
                before starting.
              </FeatureCard>
            </div>
          </Section>

          <Section id="tasks" eyebrow="Progress" title="Resume and manage tasks">
            <p className="text-body text-muted-foreground mt-4 leading-7">
              The Tasks tab lists signed-in sessions with status and completion percentage. Resume
              an in-progress task from its last persisted step, view a completed summary, or
              permanently delete a session. Starting a new task clears the current chat without
              deleting saved task history.
            </p>
          </Section>

          <Section
            id="recorder"
            eyebrow="Administrators"
            title="Create reusable guides with Recorder"
          >
            <p className="text-body text-muted-foreground mt-4 leading-7">
              The Record tab is available to administrators. It captures clicks and field
              interactions from the Cloud Console into an editable draft.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <FeatureCard icon={CircleDot} title="Capture a workflow">
                Open the Cloud Console, press Record, perform the task once, then stop capture.
              </FeatureCard>
              <FeatureCard icon={Wrench} title="Review and refine">
                Edit wording, reorder or delete steps, mark reusable parameters, and generalize
                instance-specific names.
              </FeatureCard>
              <FeatureCard icon={RotateCcw} title="Trial run">
                Use “Try it now” to test the draft through the real guide engine, then return to
                editing.
              </FeatureCard>
              <FeatureCard icon={FileJson} title="Save or export">
                Save guides to the shared library, import recordings, or download portable JSON with
                parameter values removed.
              </FeatureCard>
            </div>
          </Section>

          <Section id="dashboard" eyebrow="Account" title="Dashboard and preferences">
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <FeatureCard icon={LayoutDashboard} title="Dashboard">
                Open the full-tab dashboard for profile information and filterable task history.
              </FeatureCard>
              <FeatureCard icon={Palette} title="Theme">
                Choose Light, Dark, or System from the header settings menu. The preference is saved
                locally.
              </FeatureCard>
              <FeatureCard icon={ShieldCheck} title="Account security">
                Authentication uses Supabase sessions. Task and guide data requests carry your
                access token, and sessions are scoped to their owner.
              </FeatureCard>
            </div>
          </Section>

          <Section id="troubleshooting" eyebrow="Help" title="Common issues">
            <div className="divide-border border-border bg-card mt-7 divide-y overflow-hidden rounded-xl border">
              {TROUBLESHOOTING.map(([title, text]) => (
                <details key={title} className="group p-5">
                  <summary className="text-h1 flex cursor-pointer list-none items-center justify-between gap-4">
                    <span>{title}</span>
                    <ArrowRight
                      size={16}
                      className="text-muted-foreground shrink-0 transition-transform group-open:rotate-90"
                    />
                  </summary>
                  <p className="text-small text-muted-foreground mt-3 pr-8 leading-6">{text}</p>
                </details>
              ))}
            </div>
          </Section>

          <div className="bg-primary text-primary-foreground mt-14 rounded-2xl p-7 sm:p-9">
            <h2 className="text-2xl font-semibold">Ready to deploy?</h2>
            <p className="text-small mt-2 max-w-xl opacity-85">
              Open Baymax, choose a tested task, and let the guide stay beside you from the first
              click to completion.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-small text-primary mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 font-medium transition-opacity hover:opacity-90"
            >
              Get started <ArrowRight size={15} />
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

function BookMarkIcon() {
  return <ShieldCheck size={14} className="text-primary" />
}
