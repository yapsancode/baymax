// Marketing slide — the original Features section, framed as one deck slide.
// Scroll parallax dropped; content and staggered reveals unchanged.

import { motion } from 'framer-motion'
import { Globe, MessageCircle, Check } from 'lucide-react'
import { AnimatedTextCycle } from '@/components/shared'
import { Reveal } from '@/pages/Landing/components/Reveal'
import { staggerContainer, staggerItem } from '@/pages/Landing/components/staggerVariants'
import BaymaxChip from '@/pages/Landing/BaymaxAnimated'

const FEATURES = [
  {
    icon: Globe,
    title: 'Built for Google Cloud',
    body: 'Guidance tuned to your project, region, and services — not generic documentation.',
  },
  {
    icon: MessageCircle,
    title: 'Ask anything, anytime',
    body: 'Stuck on a step? Ask Baymax in plain language and get an answer that fits your setup.',
  },
  {
    icon: Check,
    title: 'Nothing slips through',
    body: 'Every release becomes a clear checklist, so each step is confirmed before you move on.',
  },
]

export default function MarketingFeatures() {
  return (
    <section className="flex h-dvh w-full items-center overflow-hidden px-5 pt-20 pb-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Text column */}
        <div>
          {/* Heading block */}
          <Reveal>
            <p className="text-caption text-primary tracking-[0.18em] uppercase">
              Introducing Baymax
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Deploying shouldn&apos;t feel
              <span className="block">
                <AnimatedTextCycle
                  words={['scary', 'overwhelming', 'chaotic', 'daunting']}
                  className="text-primary"
                />
              </span>
            </h2>
            <p className="text-body text-muted-foreground mt-4">
              Baymax turns a stressful release into a calm, guided walk-through.
            </p>
          </Reveal>

          {/* Feature list — staggered */}
          <motion.div
            className="mt-10 space-y-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {FEATURES.map(({ title, body }) => (
              <motion.div key={title} className="flex gap-4" variants={staggerItem}>
                <div>
                  <h3 className="text-h1">{title}</h3>
                  <p className="text-small text-muted-foreground mt-1">{body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Image column — hidden below lg */}
        <motion.div
          className="hidden lg:block"
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <BaymaxChip />
        </motion.div>
      </div>
    </section>
  )
}
