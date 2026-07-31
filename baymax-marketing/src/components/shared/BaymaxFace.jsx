// BaymaxFace — the favicon mascot recreated as an animated SVG: dark teal
// tile (#00403e), white face (#efefef), and the two dark eyes (#003835)
// joined by their connecting line. The eyes blink every few seconds —
// flattening into the line, Baymax-style — via a scaleY squash anchored to
// each eye's own center. prefers-reduced-motion renders it static.
// Used by slide 1 of the pitch deck; geometry matches public/favicon.png.

import { useState } from 'react'
import { motion } from 'framer-motion'

const BG = '#00403e'
const FACE = '#efefef'
const EYE = '#003835'

const EYES = [14, 33] // eye centers (cx), both at cy = 23.5

export function BaymaxFace({ size = 56, className = '' }) {
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Baymax"
    >
      <rect width="48" height="48" rx="9" fill={BG} />
      <ellipse cx="24" cy="23.5" rx="18.5" ry="12.5" fill={FACE} />
      {/* Connecting line — the eyes flatten into this when they blink */}
      <rect x="12.5" y="22.7" width="23" height="1.7" rx="0.85" fill={EYE} />
      {EYES.map((cx) =>
        reducedMotion ? (
          <ellipse key={cx} cx={cx} cy="23.5" rx="2.2" ry="2.2" fill={EYE} />
        ) : (
          <motion.ellipse
            key={cx}
            cx={cx}
            cy="23.5"
            rx="2.2"
            ry="2.2"
            fill={EYE}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ scaleY: [1, 0.12, 1] }}
            transition={{ duration: 0.26, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut' }}
          />
        ),
      )}
    </svg>
  )
}
