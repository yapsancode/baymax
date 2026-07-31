import { useRef, useState } from 'react'

// Hook for the page's scroll container. Returns { hidden, onScroll }.
// Attach onScroll to the page's scrollable div; pass hidden to LandingSiteNav.
export function useLandingScroll() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  // Called by Lenis scroll listener (receives raw scrollY value).
  const updateScroll = (y) => {
    const delta = y - lastY.current
    if (delta > 8) setHidden(true)
    else if (delta < -8) setHidden(false)
    lastY.current = y
  }

  // Fallback onScroll for environments where Lenis isn't running.
  const onScroll = (e) => updateScroll(e.currentTarget.scrollTop)

  return { hidden, onScroll, updateScroll }
}
