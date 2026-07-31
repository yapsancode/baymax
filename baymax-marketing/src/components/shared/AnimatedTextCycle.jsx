// Cycles through a list of words in-place, with a spring-driven width morph
// and a blur/translate enter/exit. Used in marketing headings where one word
// in a sentence rotates (e.g. "Deploying shouldn't feel [scary | overwhelming]").
//
// Renders as inline spans so it can be mounted inside an <h1>/<h2> without
// producing invalid HTML (block-level children inside heading flow).
// Respects prefers-reduced-motion: holds on the first word, no timer, no motion.

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const variants = {
  hidden: { y: -20, opacity: 0, filter: 'blur(8px)' },
  visible: {
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  exit: {
    y: 20,
    opacity: 0,
    filter: 'blur(8px)',
    transition: { duration: 0.3, ease: 'easeIn' },
  },
}

export function AnimatedTextCycle({ words, interval = 3000, className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [width, setWidth] = useState('auto')
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const measureRef = useRef(null)

  useEffect(() => {
    if (!measureRef.current) return
    const el = measureRef.current.children[currentIndex]
    if (el) setWidth(`${el.getBoundingClientRect().width}px`)
  }, [currentIndex])

  useEffect(() => {
    if (reducedMotion) return
    const timer = setInterval(() => setCurrentIndex((i) => (i + 1) % words.length), interval)
    return () => clearInterval(timer)
  }, [interval, words.length, reducedMotion])

  if (reducedMotion) {
    return <span className={className}>{words[0]}</span>
  }

  return (
    <motion.span
      className="relative inline-block"
      animate={{
        width,
        transition: { type: 'spring', stiffness: 150, damping: 15, mass: 1.2 },
      }}
    >
      {/* Measurement layer — absolute inside the relative parent so it never
          escapes into the document flow or causes page-level overflow. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 opacity-0"
        style={{ visibility: 'hidden', whiteSpace: 'nowrap' }}
      >
        {words.map((word, i) => (
          <span key={i} className={className}>
            {word}
          </span>
        ))}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={currentIndex}
          className={`inline-block ${className}`}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ whiteSpace: 'nowrap' }}
        >
          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}
