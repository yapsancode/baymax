// Marketing slide — the original closing CTA (glowing border + MatrixText)
// with the site footer merged in, as the deck's final slide.

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button, MatrixText } from '@/components/ui'
import { BaymaxLogo } from '@/components/shared'
import { Reveal } from '@/pages/Landing/components/Reveal'

export default function MarketingCta({ onGetStarted }) {
  // triggerRef is passed to MatrixText so the animation fires when
  // the card comes into view rather than on page load.
  const cardRef = useRef(null)

  return (
    <section className="flex h-dvh w-full flex-col items-center justify-center overflow-hidden px-5 pt-20 pb-24">
      <Reveal className="w-full max-w-6xl">
        {/* Glowing border: pseudo-layer uses a teal gradient that pulses */}
        <motion.div
          ref={cardRef}
          className="relative rounded-2xl p-px"
          style={{
            background:
              'linear-gradient(135deg, hsl(172 70% 45% / 0.6), hsl(180 10% 18%), hsl(172 70% 45% / 0.3))',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          {/* Inner card */}
          <div className="bg-card relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
            {/* Subtle teal radial glow behind the text */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 40% at 50% 0%, hsl(172 70% 45% / 0.08) 0%, transparent 70%)',
              }}
            />

            {/* Matrix-animated heading */}
            <MatrixText
              text="Ready to deploy?"
              triggerRef={cardRef}
              initialDelay={200}
              letterAnimationDuration={400}
              letterInterval={70}
              loop
              loopDelay={4000}
              className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl"
            />

            <p className="text-body text-muted-foreground mx-auto mt-4 max-w-md">
              Let Baymax guide your next release to Google Cloud, step by calm step.
            </p>
            <Button variant="default" size="lg" className="mt-8" onClick={onGetStarted}>
              Get started
              <ArrowRight size={18} className="ml-1.5" />
            </Button>
          </div>
        </motion.div>
      </Reveal>

      {/* Footer (merged from the old SiteFooter) */}
      <Reveal className="mt-10 w-full max-w-6xl">
        <div className="border-border flex flex-col items-center gap-4 border-t pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <BaymaxLogo size="sm" />
            <span className="text-small font-medium">Baymax</span>
          </div>
          <p className="text-caption text-muted-foreground max-w-xs">
            Tip: click the Baymax icon in your browser toolbar to open it as a side panel.
          </p>
          <p className="text-caption text-muted-foreground">© {new Date().getFullYear()} Baymax</p>
        </div>
      </Reveal>
    </section>
  )
}
