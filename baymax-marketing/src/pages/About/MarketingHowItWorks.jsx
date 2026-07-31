// Marketing slide — the original How-it-works section as one deck slide.

import { motion } from 'framer-motion'
import { Reveal } from '@/pages/Landing/components/Reveal'
import { staggerContainer, staggerItem } from '@/pages/Landing/components/staggerVariants'

const STEPS = [
  {
    n: '01',
    title: 'Connect your project',
    body: "Point Baymax at your Google Cloud project and tell it what you're shipping.",
  },
  {
    n: '02',
    title: 'Follow the guided steps',
    body: 'Baymax lays out each step with the exact commands and checks to run.',
  },
  {
    n: '03',
    title: 'Ship without the worry',
    body: 'Confirm each step, watch it go live, and keep a record of what happened.',
  },
]

export default function MarketingHowItWorks() {
  return (
    <section className="border-border bg-muted/30 flex h-dvh w-full items-center overflow-hidden border-t px-5 pt-20 pb-24">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-caption text-primary tracking-[0.18em] uppercase">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Live in three steps
          </h2>
        </Reveal>

        <motion.ol
          className="mt-14 grid gap-5 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {STEPS.map(({ n, title, body }) => (
            <motion.li
              key={n}
              className="border-border bg-card rounded-xl border p-6"
              variants={staggerItem}
            >
              <span className="text-primary text-3xl font-semibold tracking-tighter">{n}</span>
              <h3 className="text-h1 mt-3">{title}</h3>
              <p className="text-small text-muted-foreground mt-2">{body}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  )
}
