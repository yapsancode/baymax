// Reveal primitive for the marketing slides (adapted from the old scroll
// landing). `whileInView` still works in the deck because each slide mounts
// only while active — elements are already in the viewport on mount.
// Stagger variants live in ./staggerVariants.js.

import { motion } from 'framer-motion'

// Single element: fades up into view once.
// `delay` staggers sibling reveals without needing a parent container.
export function Reveal({ children, className, delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
