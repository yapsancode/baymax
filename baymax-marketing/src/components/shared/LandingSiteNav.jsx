// Floating marketing nav — shared by Landing, Docs, and About pages.
// Styled as a glass pill that floats 20px from the top and side edges — an
// island, never touching the screen. Auto-hides on scroll-down, reappears on
// scroll-up. Mobile: hamburger opens a framer-motion slide-down menu.
// Uses react-router-dom <Link> for client-side navigation.
//
// Usage: pair with the useLandingScroll hook in ./useLandingScroll.js.
// In the page's scroll container:   <div onScroll={onScroll} ...>
// Pass down to this nav:            <LandingSiteNav hidden={hidden} ... />

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Documentation', to: '/docs' },
  { label: 'About', to: '/about' },
]

export function LandingSiteNav({ hidden = false, onGetStarted }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      className="sticky top-0 z-50 p-5"
      animate={{ y: hidden ? '-150%' : '0%', opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <header className="border-border bg-background/80 mx-auto max-w-3xl rounded-xl border shadow-lg backdrop-blur-lg">
        {/* Main bar */}
        <nav className="flex items-center justify-between p-2">
          {/* Logo */}
          <Link
            to="/"
            className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1 transition-colors"
          >
            <img src="/favicon.png" alt="Baymax" className="h-6 w-6 rounded-md" />
            <span className="text-h1">Baymax</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'text-small rounded-md px-3 py-1.5 transition-colors',
                  pathname === to ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={onGetStarted}>
              Get started
            </Button>
            {/* Hamburger — mobile only */}
            <button
              className="border-border text-muted-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg border transition-colors md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </nav>

        {/* Mobile slide-down menu */}
        <AnimatePresence initial={false}>
          {open && !hidden && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="border-border overflow-hidden border-t"
            >
              <div className="flex flex-col gap-1 px-3 py-3">
                {NAV.map(({ label, to }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'text-small rounded-md px-3 py-2 transition-colors',
                      pathname === to
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {label}
                  </Link>
                ))}
                <div className="border-border mt-2 border-t pt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setOpen(false)
                      onGetStarted?.()
                    }}
                  >
                    Get started
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </motion.div>
  )
}
