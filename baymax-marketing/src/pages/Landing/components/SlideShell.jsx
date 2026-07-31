// SlideShell — one 100dvh pitch slide: centered content, cleared of the
// floating nav (top) and the dot/prev/next chrome (bottom), with a staggered
// fade-up entrance on mount. Each slide remounts on navigation (AnimatePresence
// mode="wait"), so the entrance replays on every visit.

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}
const item = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export function SlideShell({ children, className = '', center = false }) {
  return (
    <section
      className={`flex h-dvh w-full items-center justify-center overflow-hidden px-5 pt-20 pb-24 ${className}`}
    >
      <motion.div
        className={`w-full max-w-6xl ${center ? 'text-center' : ''}`}
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    </section>
  )
}

// Staggered child — wrap each block of slide content in this.
export function SlideItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}

// Small uppercase teal label above the heading (same pattern as the old
// scroll sections).
export function SlideEyebrow({ children }) {
  return <p className="text-caption text-primary tracking-[0.18em] uppercase">{children}</p>
}

// Display heading. Raw Tailwind sizes are the same documented exception the
// landing page already makes: the app type scale tops out at 1.5rem, sized
// for the side panel — full-viewport slides are hero moments. `className`
// merges via twMerge, so slides can override the size cleanly.
export function SlideTitle({ children, className = '' }) {
  return (
    <h2
      className={cn(
        'mt-3 text-4xl leading-[1.05] font-semibold tracking-tighter sm:text-5xl lg:text-6xl',
        className,
      )}
    >
      {children}
    </h2>
  )
}
