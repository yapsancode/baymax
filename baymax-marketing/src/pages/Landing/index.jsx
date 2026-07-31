// Landing page — the front door when Baymax is opened as a full-tab URL (not
// the side panel). It doubles as the live pitch deck: 8 full-viewport slides
// navigated with the ← / → arrow keys, the on-screen prev/next buttons, or
// the dot indicator. There is no scrolling — AnimatePresence swaps one
// 100dvh slide for the next with a direction-aware transition.
// (The original marketing sections live on the About page now.)
//
// Visual system: the same "Linear-style" dark marketing surface as before —
// all theming lives in the `.landing` token scope in src/index.css, and
// display headings keep the raw-size exception documented in SlideShell.

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { LandingSiteNav } from '@/components/shared'

import Slide01Team from './slides/Slide01Team'
import Slide02GcpContext from './slides/Slide02GcpContext'
import Slide03Problem from './slides/Slide03Problem'
import Slide04PainPoints from './slides/Slide04PainPoints'
import Slide05GuidingQuestion from './slides/Slide05GuidingQuestion'
import Slide05bAmbientContext from './slides/Slide05bAmbientContext'
import Slide06MeetBaymax from './slides/Slide06MeetBaymax'
import Slide07Features from './slides/Slide07Features'
import Slide08ThankYou from './slides/Slide08ThankYou'

const SLIDES = [
  { id: 'team', label: 'Team intro', Component: Slide01Team },
  { id: 'context', label: 'The context', Component: Slide02GcpContext },
  { id: 'workflow', label: 'The current workflow', Component: Slide04PainPoints },
  { id: 'problem', label: 'Problem statement', Component: Slide03Problem },
  { id: 'question', label: 'Guiding question', Component: Slide05GuidingQuestion },
  { id: 'ambient', label: 'Ambient context', Component: Slide05bAmbientContext },
  { id: 'baymax', label: 'Meet Baymax', Component: Slide06MeetBaymax },
  { id: 'features', label: 'Features & tech', Component: Slide07Features },
  { id: 'thankyou', label: 'Thank you', Component: Slide08ThankYou },
]

// Direction-aware slide swap. Under reduced motion: a plain crossfade.
const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir >= 0 ? 80 : -80 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir >= 0 ? -80 : 80 }),
}
const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

export default function Landing({ onGetStarted }) {
  // [index, direction] — direction (-1/0/1) picks the enter/exit vectors.
  const [[index, direction], setState] = useState([0, 0])
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [navVisible, setNavVisible] = useState(false)

  // Clamp at both ends — a deck doesn't wrap.
  const goTo = useCallback((next) => {
    setState(([current]) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, next))
      if (clamped === current) return [current, 0]
      return [clamped, clamped > current ? 1 : -1]
    })
  }, [])

  // Keyboard navigation: ← / → only, never while typing or with modifiers
  // (so browser/OS shortcuts and devtools keep working).
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setState(([current]) => [
          Math.min(SLIDES.length - 1, current + 1),
          current === SLIDES.length - 1 ? 0 : 1,
        ])
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setState(([current]) => [Math.max(0, current - 1), current === 0 ? 0 : -1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { Component } = SLIDES[index]

  return (
    <div className="landing bg-background text-foreground relative h-dvh w-full overflow-hidden">
      {/* Floating nav — hidden by default, appears on hover at top of screen */}
      <div
        className="absolute inset-x-0 top-0 z-40 pb-16"
        onMouseEnter={() => setNavVisible(true)}
        onMouseLeave={() => setNavVisible(false)}
      >
        <LandingSiteNav hidden={!navVisible} onGetStarted={onGetStarted} />
      </div>

      {/* Current slide (inactive slides unmount — their animations reset) */}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={index}
          className="h-dvh w-full"
          custom={direction}
          variants={reducedMotion ? fadeVariants : slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <Component onGetStarted={onGetStarted} onNext={() => goTo(index + 1)} />
        </motion.div>
      </AnimatePresence>

      {/* Bottom chrome: prev · dots · next */}
      <div className="absolute inset-x-0 bottom-5 z-40 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </Button>

        <div className="flex items-center gap-2">
          {SLIDES.map(({ id, label }, i) => (
            <button
              key={id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}: ${label}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? 'bg-primary w-5'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/60 w-2'
              }`}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goTo(index + 1)}
          disabled={index === SLIDES.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight />
        </Button>
      </div>

      {/* Counter */}
      <p className="text-caption text-muted-foreground absolute right-6 bottom-6 z-40 font-mono">
        {index + 1} / {SLIDES.length}
      </p>

      {/* Keyboard hint — first slide only */}
      {index === 0 && (
        <p className="text-caption text-muted-foreground absolute bottom-6 left-6 z-40">
          Use ← → to navigate
        </p>
      )}
    </div>
  )
}
