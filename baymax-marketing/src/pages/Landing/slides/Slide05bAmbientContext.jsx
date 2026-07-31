// Slide 5b — Ambient context. Two separate browser windows (GCP + Gemini)
// slide together and merge into one GCP window with the Baymax extension panel.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlideShell, SlideItem } from '../components/SlideShell'
import { BrowserChrome } from '../components/BrowserChrome'
import WanderMascot from '../components/WanderMascot'
import baymaxLogo from '@/assets/baymax-logo.svg'

export default function Slide05bAmbientContext() {
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [phase, setPhase] = useState(() =>
    reducedMotion ? 'merged' : 'init',
  )

  useEffect(() => {
    if (reducedMotion) return
    const t1 = setTimeout(() => setPhase('merging'), 1600)
    const t2 = setTimeout(() => setPhase('merged'), 3200)
    const loop = setTimeout(() => {
      setPhase('init')
      setTimeout(() => setPhase('merging'), 1600)
      setTimeout(() => setPhase('merged'), 3200)
    }, 9000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(loop)
    }
  }, [reducedMotion])

  return (
    <SlideShell center>
      <SlideItem className="h-[480px] w-full max-w-5xl sm:h-[540px] lg:h-[600px]">
        <AnimatePresence mode="wait">
          {phase !== 'merged' ? (
            <motion.div
              key="separate"
              className="flex h-full items-center justify-center"
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <motion.div
                className="w-[56%] sm:w-[56%]"
                initial={{ x: 0, scale: 0.96, opacity: 1 }}
                animate={{
                  x: phase === 'init' ? 0 : '50%',
                  scale: phase === 'init' ? 0.96 : 1,
                  opacity: phase === 'init' ? 1 : 0.6,
                }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              >
                <BrowserChrome
                  url="console.cloud.google.com"
                  className="mock-gcp"
                  bodyClassName="space-y-2 p-4 sm:p-5"
                >
                  <div className="bg-muted h-2.5 w-2/3 rounded-full" />
                  <div className="bg-muted h-2.5 w-1/2 rounded-full" />
                  <div className="bg-muted mt-3 h-16 w-full rounded-lg sm:h-20" />
                  <div className="bg-muted h-2.5 w-3/4 rounded-full" />
                  <div className="bg-muted h-2.5 w-1/2 rounded-full" />
                </BrowserChrome>
              </motion.div>

              <motion.div
                className="w-[56%] sm:w-[56%]"
                initial={{ x: 0, scale: 0.96, opacity: 1 }}
                animate={{
                  x: phase === 'init' ? 0 : '-50%',
                  scale: phase === 'init' ? 0.96 : 1,
                  opacity: phase === 'init' ? 1 : 0.6,
                }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              >
                <BrowserChrome
                  url="gemini.google.com"
                  className="mock-gemini"
                  bodyClassName="space-y-2 p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-muted h-3 w-3 rounded-full" />
                    <span className="text-caption text-foreground text-xs font-medium">
                      Gemini
                    </span>
                  </div>
                  <div className="bg-muted h-2 w-full rounded-full" />
                  <div className="bg-muted h-2 w-3/4 rounded-full" />
                  <div className="bg-muted mt-3 h-16 w-full rounded-lg sm:h-20" />
                  <div className="bg-muted h-2 w-1/2 rounded-full" />
                </BrowserChrome>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="merged"
              className="h-full p-4 sm:p-6 lg:p-8"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <BrowserChrome
                url="console.cloud.google.com"
                className="mock-gcp h-full"
                bodyClassName="flex h-full p-0"
              >
                {/* Main GCP page */}
                <div className="border-border flex-1 space-y-2 border-r p-4">
                  <div className="bg-muted h-3 w-2/3 rounded-full" />
                  <div className="bg-muted h-3 w-1/2 rounded-full" />
                  <div className="bg-muted mt-4 h-24 w-full rounded-lg" />
                  <div className="bg-muted h-3 w-3/4 rounded-full" />
                  <div className="bg-muted h-3 w-1/3 rounded-full" />
                </div>

                {/* Baymax extension panel */}
                <div className="mock-extension bg-background flex w-54 shrink-0 flex-col border-l sm:w-72">
                  <div className="border-border flex items-center gap-2 border-b bg-card px-3 py-2.5">
                    <img src={baymaxLogo} alt="Baymax" className="h-5 w-5" />
                    <span className="text-caption text-foreground text-xs font-medium">
                      Baymax
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 p-3">
                    <div className="bg-muted h-2 w-full rounded-full" />
                    <div className="bg-muted h-2 w-3/4 rounded-full" />
                    <div className="bg-muted h-2 w-1/2 rounded-full" />
                    <div className="bg-muted mt-2 h-12 w-full rounded-lg" />
                  </div>

                  {/* Chatbox */}
                  <div className="border-border border-t p-2.5">
                    <div className="bg-card border-border flex items-center gap-1.5 rounded-lg border px-2.5 py-2">
                      <span className="text-muted-foreground text-[10px]">Ask Baymax…</span>
                    </div>
                  </div>

                  {/* Moving mascot */}
                  <div className="border-border flex justify-center border-t py-2">
                    <WanderMascot size={44} />
                  </div>
                </div>
              </BrowserChrome>
            </motion.div>
          )}
        </AnimatePresence>
      </SlideItem>
    </SlideShell>
  )
}
