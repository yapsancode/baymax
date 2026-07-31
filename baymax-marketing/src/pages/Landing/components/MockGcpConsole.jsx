// MockGcpConsole — the GCP Console home page (light, `.mock-gcp` palette from
// src/index.css) with the hamburger nav EXPANDED. A cursor roams the drawer,
// hovering over every product option in turn — slide 2's "so many products,
// where do I even start?" beat. The drawer rows are a fixed height (h-7) so
// the cursor's vertical target is simple arithmetic (ROW_H); keep the two in
// sync if you restyle. Freezes on the first item under reduced motion.
// Purely visual: no handlers, no real inputs.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Menu,
  Search,
  Home,
  Zap,
  Server,
  Database,
  HardDrive,
  PieChart,
  Boxes,
  Network,
  Key,
  CreditCard,
  MousePointer2,
} from 'lucide-react'

// The expanded hamburger menu — a taste of the console's product list.
const MENU = [
  { icon: Home, label: 'Home' },
  { icon: Zap, label: 'Cloud Run' },
  { icon: Server, label: 'Compute Engine' },
  { icon: Database, label: 'Cloud SQL' },
  { icon: HardDrive, label: 'Cloud Storage' },
  { icon: PieChart, label: 'BigQuery' },
  { icon: Boxes, label: 'Kubernetes Engine' },
  { icon: Network, label: 'VPC network' },
  { icon: Key, label: 'IAM & admin' },
  { icon: CreditCard, label: 'Billing' },
]

const ROW_H = 28 // drawer rows are h-7 — keep in sync
const PAD_T = 8 // drawer p-2 — keep in sync
const HOVER_MS = 850

export function MockGcpConsole({ className = '' }) {
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [hoverIndex, setHoverIndex] = useState(0)

  // Walk the cursor down the menu, one option at a time, looping.
  useEffect(() => {
    if (reducedMotion) return
    const id = setInterval(() => setHoverIndex((i) => (i + 1) % MENU.length), HOVER_MS)
    return () => clearInterval(id)
  }, [reducedMotion])

  return (
    <div className={`text-left ${className}`}>
      {/* Console top bar — hamburger in its active (expanded) state */}
      <div className="border-border bg-card flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-muted flex h-6 w-6 items-center justify-center rounded-md">
          <Menu size={14} className="text-foreground shrink-0" />
        </span>
        <span className="text-small text-foreground font-medium whitespace-nowrap">
          Google Cloud
        </span>
        <div className="bg-muted mx-3 hidden flex-1 items-center gap-2 rounded-full px-3 py-1 sm:flex">
          <Search size={11} className="text-muted-foreground shrink-0" />
          <span className="text-caption text-muted-foreground truncate">
            Search for resources, services, and docs
          </span>
        </div>
        <span className="bg-primary text-primary-foreground ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium sm:ml-0">
          P
        </span>
      </div>

      <div className="bg-muted/50 flex">
        {/* Expanded nav drawer */}
        <div className="border-border bg-card relative w-36 shrink-0 border-r p-2">
          {MENU.map(({ icon: Icon, label }, i) => (
            <div
              key={label}
              className={`flex h-7 items-center gap-2 rounded-md px-2 transition-colors duration-200 ${
                i === hoverIndex ? 'bg-muted' : ''
              }`}
            >
              <Icon
                size={12}
                className={`shrink-0 ${
                  i === hoverIndex ? 'text-foreground' : 'text-muted-foreground'
                }`}
              />
              <span className="text-caption text-foreground truncate">{label}</span>
            </div>
          ))}

          {/* Roaming cursor — glides to each option in turn */}
          <motion.span
            className="text-foreground pointer-events-none absolute z-10 drop-shadow"
            style={{ left: 36 }}
            initial={{ top: PAD_T + 7 }}
            animate={{ top: PAD_T + hoverIndex * ROW_H + 7 }}
            transition={{ type: 'tween', duration: 0.35, ease: 'easeInOut' }}
          >
            <MousePointer2 size={14} fill="currentColor" />
          </motion.span>
        </div>

        {/* Dashboard — kept quiet so the drawer + cursor stay the focus */}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <p className="text-caption text-muted-foreground">My First Project</p>
          <p className="text-h1 mt-0.5">Dashboard</p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {['Resources', 'APIs', 'Billing'].map((title) => (
              <div
                key={title}
                className="border-border bg-card rounded-lg border p-3 last:hidden sm:last:block"
              >
                <p className="text-caption text-muted-foreground">{title}</p>
                <div className="bg-muted mt-2 h-2.5 w-2/3 rounded-full" />
                <div className="bg-muted mt-1.5 h-2.5 w-1/3 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
