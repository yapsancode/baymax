// MockWindowSwitch — TWO overlapping browser windows (Google Cloud + Gemini)
// on one desktop stage, built for slide 4's window-switching demo. The
// focused window sits in front at full opacity; the other shrinks back,
// dimmed.
//
// On switch: both windows slide apart side-by-side, swap z-order, then
// slide back together — a smooth "deck reveal" instead of the old loopy
// drag. The FrictionTrail's energy meter still taxes these beats hardest.

import { motion } from 'framer-motion'
import { BrowserChrome } from './BrowserChrome'

const WINDOWS = [
  {
    id: 'gcp',
    url: 'console.cloud.google.com/run/deploy',
    scope: 'mock-gcp',
    position: 'left-0 top-0 right-8 bottom-8 sm:right-12 sm:bottom-10',
  },
  {
    id: 'gemini',
    url: 'gemini.google.com',
    scope: 'mock-gemini',
    position: 'left-8 right-0 top-8 bottom-0 sm:left-12 sm:top-10',
  },
]

// 3-keyframe sequence: rest → split → settle.
// When a window transitions (active ↔ inactive) both windows animate
// simultaneously: move apart to center, then settle to the new positions.
const SPLIT = {
  gcp: { x: [0, 44, 0], y: [0, -4, 0] },
  gemini: { x: [0, -44, 0], y: [0, -4, 0] },
}

const ACTIVE_TRANSITION = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 1,
}

export function MockWindowSwitch({
  activeWindow,
  onFocusWindow,
  reducedMotion = false,
  renderContent,
  className = '',
}) {
  return (
    <div className={`bg-muted/30 relative rounded-2xl ${className}`}>
      {WINDOWS.map(({ id, url, scope, position }) => {
        const active = id === activeWindow
        return (
          <motion.div
            key={id}
            className={`absolute ${position} ${active ? '' : 'cursor-pointer'}`}
            initial={false}
            style={{ zIndex: active ? 10 : 0 }}
            animate={
              active
                ? {
                    opacity: [0.55, 0.8, 1],
                    scale: [0.97, 0.85, 1],
                    x: SPLIT[id].x,
                    y: SPLIT[id].y,
                  }
                : {
                    opacity: [1, 0.8, 0.55],
                    scale: [1, 0.85, 0.97],
                    x: SPLIT[id].x,
                    y: SPLIT[id].y,
                  }
            }
            transition={reducedMotion ? { duration: 0 } : ACTIVE_TRANSITION}
            onClick={active ? undefined : () => onFocusWindow(id)}
          >
            <BrowserChrome
              url={url}
              className={`${scope} flex h-full flex-col`}
              bodyClassName="relative flex-1 overflow-hidden"
            >
              {renderContent(id)}
            </BrowserChrome>
          </motion.div>
        )
      })}
    </div>
  )
}
