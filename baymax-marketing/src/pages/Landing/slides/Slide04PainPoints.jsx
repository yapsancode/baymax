// Slide 4 — Current workflow pain points, presenter-driven edition.
// "Here's what people do when they get stuck." Two columns: a FrictionTrail
// (aligned step bars + vertical cognitive-energy meter) on the left, a
// desktop with TWO overlapping browser windows (Google Cloud / Gemini) on
// the right.
// Nothing advances automatically — the presenter walks the steps by clicking
// a card, clicking the back window, or pressing ↑ / ↓ (← / → stay with the
// deck's slide navigation). Each step is its own beat:
//
//   0 Error deploying    GCP deploy fails, error banner appears
//   1 Screenshot         flash pulse over the GCP page
//   2 Switch window      Gemini window loops slowly to the front (the tedious drag)
//   3 Paste image        screenshot attachment appears
//   4 Describe problem   question bubble appears
//   5 Wait               thinking sparkle, then Gemini's reply renders
//   6 Switch back        GCP window loops back to the front
//   7 Hunt for the button  highlight roams the GCP form fields
//
// The window switches are deliberately slow (a ~1.4s circular drag) — the
// tedium IS the point, and the energy meter taxes them hardest. Clicking the
// back window performs the matching switch beat (Gemini → step 2, GCP →
// step 6), so the trail always agrees with the screen. Steps are reversible —
// bubble/energy visibility derives from `step`, so walking backward retracts
// them cleanly. The slide unmounts when inactive, which also removes its
// keydown listener.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import { SlideShell, SlideItem, SlideTitle } from '../components/SlideShell'
import { MockWindowSwitch } from '../components/MockWindowSwitch'
import { MockGcpRun } from '../components/MockGcpRun'
import { MockAiChat } from '../components/MockAiChat'
import { FrictionTrail } from '../components/FrictionTrail'

const STEPS = [
  'Error deploying',
  'Screenshot',
  'Switch window',
  'Paste image',
  'Describe problem',
  'Wait',
  'Switch back',
  'Hunt for the button',
]

// Which steps show the Gemini window in front (everything else shows GCP).
const GEMINI_STEPS = [2, 3, 4, 5]

export default function Slide04PainPoints() {
  const [step, setStep] = useState(0)
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const activeWindow = GEMINI_STEPS.includes(step) ? 'gemini' : 'gcp'

  // ↑ / ↓ walk the steps hands-free. Same guards as the deck: no modifiers,
  // never while typing.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setStep((s) => Math.min(STEPS.length - 1, s + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setStep((s) => Math.max(0, s - 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Clicking the back window performs the matching "switch" beat — a no-op
  // if that window is already in front.
  const handleWindowFocus = (id) => {
    if (id === 'gemini' && activeWindow !== 'gemini') setStep(2)
    if (id === 'gcp' && activeWindow !== 'gcp') setStep(6)
  }

  return (
    <SlideShell>
      <SlideItem className="text-center">
        <SlideTitle className="text-3xl sm:text-4xl lg:text-5xl">
          Here&apos;s what people do when they get <span className="text-primary">stuck</span>.
        </SlideTitle>
      </SlideItem>

      <div className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
        {/* Friction trail — pinned cards + the brain-fry meter */}
        <SlideItem>
          <FrictionTrail
            steps={STEPS}
            step={step}
            onStepChange={setStep}
            reducedMotion={reducedMotion}
          />
        </SlideItem>

        {/* One desktop, two windows */}
        <SlideItem>
          <MockWindowSwitch
            activeWindow={activeWindow}
            onFocusWindow={handleWindowFocus}
            reducedMotion={reducedMotion}
            className="h-[420px] sm:h-[460px]"
            renderContent={(id) =>
              id === 'gcp' ? (
                <div className="relative h-full overflow-hidden">
                  <MockGcpRun
                    error={step === 0 || step === 1}
                    hunting={step === 7 && !reducedMotion}
                    huntingStatic={step === 7 && reducedMotion}
                  />
                  {/* Screenshot capture — cursor drags a low-opacity rectangle */}
                  {step === 1 && (
                    <>
                      <AnimatePresence>
                        {!reducedMotion && (
                          <motion.div
                            key="selection"
                            className="pointer-events-none absolute inset-0"
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <motion.div
                              className="absolute overflow-hidden rounded-md"
                              initial={{
                                left: '50%',
                                top: '35%',
                                width: '2%',
                                height: '2%',
                              }}
                              animate={{
                                left: '35%',
                                top: '25%',
                                width: '40%',
                                height: '40%',
                              }}
                              transition={{
                                duration: 1.2,
                                ease: 'easeInOut',
                                repeat: Infinity,
                                repeatDelay: 0.6,
                              }}
                            >
                              <div
                                className="absolute inset-0 rounded-md"
                                style={{
                                  border: '2px dashed #4285f4',
                                  backgroundColor: 'rgba(66, 133, 244, 0.28)',
                                }}
                              />
                            </motion.div>
                            <motion.div
                              className="absolute z-10"
                              initial={{ left: '51%', top: '35%' }}
                              animate={{ left: '75%', top: '65%' }}
                              transition={{
                                duration: 1.2,
                                ease: 'easeInOut',
                                repeat: Infinity,
                                repeatDelay: 0.6,
                              }}
                            >
                              <MousePointer2 size={14} className="text-[#1a73e8]" />
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div
                        className="text-caption text-primary bg-primary/10 absolute top-3 right-3 rounded-md px-2 py-1 font-medium"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: reducedMotion ? 0 : 1.2, duration: 0.3 }}
                      >
                        Screenshot captured
                      </motion.div>
                    </>
                  )}
                </div>
              ) : (
                <MockAiChat step={step} className="h-full" />
              )
            }
          />
        </SlideItem>
      </div>
    </SlideShell>
  )
}
