// MatrixText — letters scramble through 0/1 before resolving to the real character.
// Adapted from the Kokonut UI MatrixText component (kokonutui.io).
//
// Changes from the original:
//  - TypeScript → JSX (no interfaces)
//  - `motion/react` → `framer-motion` (already installed at v12)
//  - Removed min-h-screen wrapper — component renders inline
//  - Added `triggerRef` prop: animation fires when the ref enters the viewport
//    (via IntersectionObserver) instead of immediately on mount
//  - `matrixColor` prop instead of hard-coded green, defaults to landing teal

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function MatrixText({
  text = 'Hello World',
  className,
  initialDelay = 0,
  letterAnimationDuration = 400,
  letterInterval = 80,
  matrixColor = 'hsl(172 70% 45%)',
  triggerRef, // optional ref — if provided, animation starts when it enters view
  loop = false, // repeat animation on a timer after it completes
  loopDelay = 3000,
}) {
  const [letters, setLetters] = useState(() =>
    text.split('').map((char) => ({
      char,
      isMatrix: false,
      isSpace: char === ' ',
    })),
  )
  const [isAnimating, setIsAnimating] = useState(false)
  const hasTriggered = useRef(false)

  const getRandomChar = useCallback(() => (Math.random() > 0.5 ? '1' : '0'), [])

  const animateLetter = useCallback(
    (index) => {
      if (index >= text.length) return
      requestAnimationFrame(() => {
        setLetters((prev) => {
          const next = [...prev]
          if (!next[index].isSpace) {
            next[index] = { ...next[index], char: getRandomChar(), isMatrix: true }
          }
          return next
        })
        setTimeout(() => {
          setLetters((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], char: text[index], isMatrix: false }
            return next
          })
        }, letterAnimationDuration)
      })
    },
    [getRandomChar, text, letterAnimationDuration],
  )

  const startAnimation = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    let i = 0
    const step = () => {
      if (i >= text.length) {
        setIsAnimating(false)
        return
      }
      animateLetter(i++)
      setTimeout(step, letterInterval)
    }
    step()
  }, [animateLetter, text, isAnimating, letterInterval])

  // Fire animation: either when triggerRef enters view, or after initialDelay on mount.
  useEffect(() => {
    const target = triggerRef?.current
    if (!target) {
      const t = setTimeout(startAnimation, initialDelay)
      return () => clearTimeout(t)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true
          setTimeout(startAnimation, initialDelay)
        }
      },
      { threshold: 0.4 },
    )
    io.observe(target)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — fires once on mount

  // Optional loop
  useEffect(() => {
    if (!loop) return
    const t = setInterval(
      startAnimation,
      loopDelay + letterAnimationDuration + text.length * letterInterval,
    )
    return () => clearInterval(t)
  }, [loop, loopDelay, startAnimation, letterAnimationDuration, text.length, letterInterval])

  const matrixVariant = useMemo(
    () => ({
      matrix: {
        color: matrixColor,
        textShadow: `0 0 12px ${matrixColor}`,
      },
    }),
    [matrixColor],
  )

  return (
    <div className={cn('flex items-center justify-center', className)} aria-label={text}>
      <div className="flex flex-wrap items-center justify-center">
        {letters.map((letter, index) => (
          <motion.span
            key={index}
            className="font-mono"
            initial="initial"
            animate={letter.isMatrix ? 'matrix' : 'normal'}
            variants={matrixVariant}
            transition={{ duration: 0.08, ease: 'easeInOut' }}
            style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums' }}
          >
            {letter.isSpace ? ' ' : letter.char}
          </motion.span>
        ))}
      </div>
    </div>
  )
}
