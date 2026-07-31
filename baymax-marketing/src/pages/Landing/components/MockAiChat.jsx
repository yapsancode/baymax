// MockAiChat — a dark Gemini-style workspace mock for slide 4's
// painful-workflow demo. The palette comes from the scoped `.mock-gemini`
// tokens in src/index.css. Each step is a manually triggered beat and can
// go backward — the >= logic retracts bubbles cleanly:
//   step === 2 → cursor glides to the composer, focus ring appears
//   step >= 3  → the pasted screenshot
//   step >= 4  → the typed question
//   step === 5 → Gemini's pulsing "thinking" sparkle, then its reply renders
//                (a beat later — and it persists once it lands)

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ArrowUp,
  Image as ImageIcon,
  ChevronDown,
  MousePointer2,
  MessageSquare,
} from 'lucide-react'

const bubble = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export function MockAiChat({ step = 0, className = '' }) {
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  return (
    <div className={`bg-background text-foreground flex h-full text-left ${className}`}>
      {/* Sidebar */}
      <aside className="border-border bg-card hidden w-28 shrink-0 flex-col justify-between border-r p-2 sm:flex md:w-32">
        <div>
          <div className="border-border mb-2 flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <span className="bg-primary flex h-6 w-6 items-center justify-center rounded-lg text-primary-foreground">
                <Sparkles size={12} />
              </span>
              <span className="text-small font-semibold">Gemini</span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground px-2 py-1.5 font-semibold uppercase tracking-wider">
            Recent chats
          </div>
          <div className="space-y-0.5">
            {['Deploy to Cloud Run', 'IAM roles', 'Cloud SQL setup'].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  i === 0
                    ? 'bg-accent/30 text-foreground'
                    : 'text-muted-foreground hover:bg-accent/20'
                }`}
              >
                <MessageSquare size={11} />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border mt-auto flex items-center gap-2 border-t pt-2">
          <span className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold">
            P
          </span>
          <div className="overflow-hidden">
            <p className="text-xs font-medium truncate">Team Penta</p>
            <p className="text-[10px] text-muted-foreground truncate">Pro</p>
          </div>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="border-border flex h-12 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <span className="text-small font-semibold truncate">Deploy to Cloud Run</span>
            <span className="bg-primary/10 text-primary border-primary/20 rounded border px-1.5 py-0.5 text-[10px] font-mono">
              Flash
            </span>
          </div>
          <button className="bg-muted hover:bg-accent/50 text-foreground rounded-lg px-2.5 py-1 text-xs font-medium transition">
            Share
          </button>
        </header>

        {/* Messages */}
        <div className="flex flex-1 flex-col justify-end gap-5 overflow-hidden p-4">
          <AnimatePresence>
            {/* Pasted screenshot + user question */}
            {step >= 3 && (
              <motion.div
                key="user"
                className="flex flex-row-reverse gap-3"
                variants={bubble}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: 5 }}
              >
                <span className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                  U
                </span>
                <div className="flex-1 space-y-2 text-right">
                  <span className="text-[10px] font-semibold text-muted-foreground">You</span>
                  <div className="bg-card border-border ml-auto flex w-fit items-center gap-2 rounded-xl border px-2.5 py-2">
                    <span className="bg-muted flex h-8 w-10 items-center justify-center rounded-md">
                      <ImageIcon size={13} className="text-muted-foreground" />
                    </span>
                    <span>
                      <span className="text-caption text-foreground block text-left font-medium">
                        screenshot.png
                      </span>
                      <span className="text-caption text-muted-foreground block text-left">Image</span>
                    </span>
                  </div>
                  {step >= 4 && (
                    <p className="text-small text-foreground">
                      how do i troubleshoot this error
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Gemini thinking indicator */}
            {step === 5 && (
              <motion.div
                key="thinking"
                className="flex items-center gap-2"
                variants={bubble}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
              >
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles size={14} className="text-primary" />
                </motion.span>
                <span className="text-caption text-muted-foreground">Gemini is thinking…</span>
              </motion.div>
            )}

            {/* Gemini reply */}
            {step >= 5 && (
              <motion.div
                key="answer"
                className="flex gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut', delay: reducedMotion ? 0 : 1.4 }}
              >
                <span className="bg-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary-foreground text-xs font-semibold">
                  <Sparkles size={12} />
                </span>
                <div className="flex-1 space-y-2">
                  <span className="text-[10px] font-semibold text-primary">Gemini</span>
                  <p className="text-small text-foreground">
                    Your container crashed because it has no <span className="font-medium">start</span>{' '}
                    script and isn’t listening on the <span className="font-medium">$PORT</span>{' '}
                    environment variable. Add a <span className="font-medium">start</span> script to your
                    package.json and bind your server to <span className="font-medium">process.env.PORT</span>.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom input dock */}
        <div className="border-border p-3 border-t">
          <div className="relative">
            <div
              className={`bg-card relative flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                step === 2 ? 'border-primary ring-primary/40 ring-2' : 'border-border'
              }`}
            >
              <span className="text-muted-foreground">+</span>
              <span className="text-small text-muted-foreground flex-1 truncate">
                Ask Gemini…
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="bg-primary h-1.5 w-1.5 rounded-full" />
                  Flash
                  <ChevronDown size={10} />
                </span>
                <span className="bg-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <ArrowUp size={12} className="text-primary-foreground" />
                </span>
              </div>
              {step === 2 && !reducedMotion && (
                <motion.span
                  className="text-foreground absolute -right-1 -bottom-2"
                  initial={{ x: 70, y: 36, opacity: 0 }}
                  animate={{ x: 0, y: 0, opacity: 1 }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                >
                  <MousePointer2 size={15} fill="currentColor" />
                </motion.span>
              )}
            </div>
          </div>
          <p className="text-caption text-muted-foreground mt-1.5 text-center">
            Gemini can make mistakes. Check important info.
          </p>
        </div>
      </main>
    </div>
  )
}
