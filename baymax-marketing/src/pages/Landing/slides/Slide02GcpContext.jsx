// Slide 2 — The context: GCP is hard to navigate.
// Split layout: narrative on the left, a mock GCP Console home page with the
// hamburger nav expanded (inside a browser-chrome wrapper) on the right — a
// cursor hovers through the product list while a "Where do I even start?"
// callout floats above. The real console.cloud.google.com can't be iframed
// (X-Frame-Options) — hence the mock.

import { motion } from 'framer-motion'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import { BrowserChrome } from '../components/BrowserChrome'
import { MockGcpConsole } from '../components/MockGcpConsole'

export default function Slide02GcpContext() {
  return (
    <SlideShell>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Narrative */}
        <div>
          <SlideItem>
            <SlideEyebrow>The context</SlideEyebrow>
            <SlideTitle className="text-4xl sm:text-5xl">
              One site we found hard to navigate:{' '}
              <span className="text-primary">Google Cloud Platform</span>.
            </SlideTitle>
          </SlideItem>
        </div>

        {/* Mock console + callout */}
        <SlideItem className="relative">
          <BrowserChrome url="console.cloud.google.com/home/dashboard" className="mock-gcp">
            <MockGcpConsole />
          </BrowserChrome>

          {/* Floating callout bubble */}
          <motion.div
            className="absolute -top-5 -right-3 sm:-right-5"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="border-primary/40 bg-card rounded-xl border px-4 py-2.5 shadow-lg">
              <p className="text-small text-primary font-medium">
                &ldquo;Where do I even start?&rdquo;
              </p>
            </div>
            {/* Bubble tail */}
            <div className="border-primary/40 bg-card ml-8 h-3 w-3 -translate-y-1.5 rotate-45 border-r border-b" />
          </motion.div>
        </SlideItem>
      </div>
    </SlideShell>
  )
}
