// Celebration screen shown when every guide step is done.
//
// Rendered by src/pages/Guidance/index.jsx once the final step completes (the
// user clicked the real "Create instance" button, or pressed Finish). Uses the
// pixel sprite mascots (components/shared/mascotPixels.js) — a backflip on
// success, a faceplant when the run stopped on its last step. This is a
// different figure from the on-page mascot in public/guide-overlay.js, which is
// drawn in CSS inside the content script's shadow root.

import { Button, Card } from '@/components/ui'
import { SuccessMascot, ErrorMascot } from '@/components/shared'
import { Check, CheckCircle2, ListChecks, PencilLine, Sparkles } from 'lucide-react'

// A handful of confetti pieces — colour, horizontal position, and timing are
// staggered so they don't fall in lockstep.
const CONFETTI = [
  { left: '8%', color: 'var(--color-primary)', delay: '0s', dur: '2.6s' },
  { left: '20%', color: 'var(--color-warning)', delay: '0.5s', dur: '3.1s' },
  { left: '32%', color: 'var(--color-info)', delay: '1.1s', dur: '2.8s' },
  { left: '45%', color: 'var(--color-purple)', delay: '0.2s', dur: '3.3s' },
  { left: '57%', color: 'var(--color-success)', delay: '0.8s', dur: '2.5s' },
  { left: '68%', color: 'var(--color-warning)', delay: '1.4s', dur: '3.0s' },
  { left: '80%', color: 'var(--color-info)', delay: '0.3s', dur: '2.9s' },
  { left: '90%', color: 'var(--color-primary)', delay: '1.0s', dur: '3.2s' },
  { left: '14%', color: 'var(--color-success)', delay: '1.7s', dur: '2.7s' },
  { left: '74%', color: 'var(--color-purple)', delay: '2.0s', dur: '3.0s' },
]

// Twinkling sparkles scattered around Baymax.
const SPARKLES = [
  { top: '6%', left: '16%', size: 16, delay: '0s' },
  { top: '14%', left: '82%', size: 22, delay: '0.6s' },
  { top: '46%', left: '6%', size: 14, delay: '1.1s' },
  { top: '40%', left: '90%', size: 18, delay: '0.3s' },
]

// Fallback bullets for guides that don't declare their own nextSteps
// (pre-real-data recordings and dynamic blueprints).
const DEFAULT_NEXT_STEPS = [
  'Wait for the resource status to turn green in the console.',
  'Keep any passwords or keys you set during the guide safe.',
  'Ready for more? Start another guided task below.',
]

// Bullets for a TRIAL run of a recorded draft ("Try it now") — the point of
// the run was to judge the recording, so what's-next is about the draft.
const TRIAL_NEXT_STEPS = [
  'Happy with how it navigated? Go back and hit "Save guide".',
  'A step misbehaved? Edit its wording, reorder it, or re-record.',
  'Your draft is still in the Recorder — nothing was lost.',
]

// Bullets shown when the run ended on a failed final step (see `success`).
const ERROR_NEXT_STEPS = [
  "The last step didn't complete — nothing was broken, it just didn't finish.",
  'Retry it in the console, or start the task over from the top.',
  'Still stuck? Ask Baymax in the chat and describe what you saw.',
]

export default function GuidanceComplete({
  guideTitle = 'your deployment',
  totalSteps,
  nextSteps,
  onNewTask,
  onDone,
  // Present only after a trial run of a recorded draft: swaps the actions to
  // "Back to editing" (the Recorder still holds the draft).
  onBackToEditing,
  // Outcome of the run, read from the final step's status in Guidance: true =
  // finished cleanly (Success mascot + confetti), false = ended on a failed
  // step (Error mascot, no celebration). Defaults to success.
  success = true,
}) {
  const trialRun = Boolean(onBackToEditing)
  const whatsNext = !success
    ? ERROR_NEXT_STEPS
    : trialRun
      ? TRIAL_NEXT_STEPS
      : nextSteps?.length
        ? nextSteps
        : DEFAULT_NEXT_STEPS
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {/* confetti rains over the whole screen — celebration only */}
        {success && (
          <div className="bx-confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="bx-confetti-piece"
                style={{
                  left: c.left,
                  background: c.color,
                  animationDelay: c.delay,
                  animationDuration: c.dur,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative flex flex-col items-center px-6 pt-8 pb-6 text-center">
          {/* Pixel Baymax, chosen by outcome: backflip + confetti on success,
              faceplant + alarm bangs on a failed final step. Sparkles and the
              green check badge are celebration chrome, so success-only. */}
          <div className="bx-stage relative">
            {success &&
              SPARKLES.map((s, i) => (
                <Sparkles
                  key={i}
                  className="bx-sparkle text-primary"
                  size={s.size}
                  style={{ top: s.top, left: s.left, animationDelay: s.delay }}
                  aria-hidden="true"
                />
              ))}
            {success ? <SuccessMascot size={128} /> : <ErrorMascot size={128} />}
            {success && (
              <span className="bx-badge">
                <Check size={18} strokeWidth={3} />
              </span>
            )}
          </div>

          <h1 className="text-display mt-5">
            {!success
              ? "Didn't quite finish"
              : trialRun
                ? 'Trial run complete! 🎉'
                : 'All done! 🎉'}
          </h1>
          <p className="text-body text-muted-foreground mt-2 max-w-xs">
            {!success ? (
              <>
                This run of <span className="text-foreground font-medium">{guideTitle}</span> stopped
                on the last step.
              </>
            ) : (
              <>
                {trialRun ? 'You finished a test run of ' : 'You finished '}
                <span className="text-foreground font-medium">{guideTitle}</span>.
              </>
            )}
          </p>

          {totalSteps && success ? (
            <div className="bg-success-soft mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5">
              <CheckCircle2 size={15} className="text-success" />
              <span className="text-caption text-success font-medium">
                {totalSteps} of {totalSteps} steps complete
              </span>
            </div>
          ) : null}

          <Card className="mt-6 w-full max-w-xs p-4 text-left">
            <p className="text-caption text-muted-foreground">
              {success ? "WHAT'S NEXT" : 'WHAT YOU CAN TRY'}
            </p>
            <ul className="text-small mt-2 space-y-2">
              {whatsNext.map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {text}
                </li>
              ))}
            </ul>
          </Card>

          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            {trialRun ? (
              <>
                {/* A trial creates no session, so "View my tasks" would show
                    nothing about it — the two useful moves are back to the
                    draft, or on to something else. */}
                <Button onClick={onBackToEditing}>
                  <PencilLine size={16} /> Back to editing
                </Button>
                <Button variant="outline" onClick={onNewTask}>
                  <Sparkles size={16} /> Start a new task
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onNewTask}>
                  <Sparkles size={16} /> Start a new task
                </Button>
                <Button variant="outline" onClick={onDone}>
                  <ListChecks size={16} /> View my tasks
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .bx-stage { width: 180px; height: 180px; display: grid; place-items: center; }
        .bx-figure { animation: bxFloat 3.2s ease-in-out infinite; transform-origin: center; }
        .bx-figure .bx-eyes { transform-box: fill-box; transform-origin: center; animation: bxBlink 5s ease-in-out infinite; }
        .bx-arm { transform-box: fill-box; transform-origin: bottom center; }
        .bx-arm-left { animation: bxWaveL 1.8s ease-in-out infinite; }
        .bx-arm-right { animation: bxWaveR 1.8s ease-in-out infinite; }

        .bx-badge {
          position: absolute; right: 18px; bottom: 26px;
          width: 34px; height: 34px; border-radius: 9999px;
          display: grid; place-items: center;
          background: var(--color-success); color: var(--color-primary-foreground);
          box-shadow: 0 4px 12px rgba(0,0,0,0.18);
          animation: bxPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s both;
        }
        .bx-sparkle { position: absolute; animation: bxTwinkle 2.4s ease-in-out infinite; }

        .bx-confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .bx-confetti-piece {
          position: absolute; top: -12px; width: 8px; height: 12px; border-radius: 2px;
          opacity: 0; animation-name: bxConfetti; animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes bxFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes bxBlink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes bxWaveL { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(7deg); } }
        @keyframes bxWaveR { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-7deg); } }
        @keyframes bxPop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
        @keyframes bxTwinkle { 0%, 100% { transform: scale(0.6); opacity: 0.3; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes bxConfetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bx-figure, .bx-arm-left, .bx-arm-right, .bx-eyes, .bx-sparkle, .bx-confetti-piece, .bx-badge { animation: none; }
          .bx-confetti { display: none; }
        }
      `}</style>
    </div>
  )
}
