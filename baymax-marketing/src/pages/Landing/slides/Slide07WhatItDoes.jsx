// Slide 7 — What Baymax does (the demo summary).
// Left: numbered list of the three things Baymax does. Right: a mock browser
// where a highlighted button pulses and a cursor glides over to click it —
// the visual-guidance idea in one loop.

import { motion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import { BrowserChrome } from '../components/BrowserChrome'

const POINTS = [
  {
    n: '01',
    title: 'Understands where you are',
    body: "Reads the DOM of the page you're on, so it knows exactly where you're at.",
  },
  {
    n: '02',
    title: 'Generates step-by-step guidance',
    body: 'Relevant navigational steps for your task — not generic documentation.',
  },
  {
    n: '03',
    title: 'Shows you exactly what to click',
    body: 'Highlights the right element on the page, right when you need it.',
  },
]

export default function Slide07WhatItDoes() {
  return (
    <SlideShell>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Numbered list */}
        <div>
          <SlideItem>
            <SlideEyebrow>How Baymax helps</SlideEyebrow>
            <SlideTitle className="text-3xl sm:text-4xl lg:text-5xl">
              Guidance that sits <span className="text-primary">beside you</span>.
            </SlideTitle>
          </SlideItem>

          <div className="mt-8 space-y-6">
            {POINTS.map(({ n, title, body }) => (
              <SlideItem key={n} className="flex gap-4">
                <span className="text-primary text-2xl font-semibold tracking-tighter">{n}</span>
                <div>
                  <h3 className="text-h1">{title}</h3>
                  <p className="text-small text-muted-foreground mt-1">{body}</p>
                </div>
              </SlideItem>
            ))}
          </div>
        </div>

        {/* Animated illustration */}
        <SlideItem>
          <BrowserChrome
            url="console.cloud.google.com/run/deploy"
            className="mock-gcp"
            bodyClassName="p-5 sm:p-6"
          >
            {/* Generic page skeleton */}
            <div className="space-y-3">
              <div className="bg-muted h-3 w-1/3 rounded-full" />
              <div className="bg-muted h-3 w-2/3 rounded-full" />
              <div className="bg-muted h-3 w-1/2 rounded-full" />
            </div>

            {/* The highlighted button + cursor loop */}
            <div className="mt-10 flex justify-center pb-6">
              <div className="relative">
                {/* Pulsing highlight ring — ring-ring is the brand teal, so the
                    Baymax highlight stays teal inside the Google-blue mock */}
                <motion.span
                  className="ring-ring pointer-events-none absolute -inset-1.5 rounded-lg ring-2"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="bg-primary text-small text-primary-foreground rounded-lg px-5 py-2 font-medium">
                  Deploy
                </span>

                {/* Cursor: glides in from the side, clicks, drifts back out */}
                <motion.span
                  className="text-foreground pointer-events-none absolute -right-1 -bottom-1"
                  animate={{
                    x: [90, 0, 0, 90],
                    y: [50, 0, 0, 50],
                    scale: [1, 1, 0.8, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    times: [0, 0.5, 0.65, 1],
                    ease: 'easeInOut',
                  }}
                >
                  <MousePointer2 size={18} fill="currentColor" />
                </motion.span>
              </div>
            </div>
          </BrowserChrome>
        </SlideItem>
      </div>
    </SlideShell>
  )
}
