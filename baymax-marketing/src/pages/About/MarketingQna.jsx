// Marketing slide — the original QnA accordion as one deck slide.

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Reveal } from '@/pages/Landing/components/Reveal'
import { staggerContainer, staggerItem } from '@/pages/Landing/components/staggerVariants'

const FAQS = [
  {
    q: 'Do I need to know gcloud commands already?',
    a: 'No. Baymax gives you the exact commands for each step and explains what they do, so you can follow along even on your first deploy.',
  },
  {
    q: 'Which Google Cloud services does it cover?',
    a: 'The common deployment paths — Cloud Run, App Engine, and GKE — plus the supporting setup like IAM, builds, and environment config.',
  },
  {
    q: 'Will it change anything in my project automatically?',
    a: 'Only when you confirm a step. Baymax walks you through each action and waits for you before moving on.',
  },
  {
    q: 'Can I come back to a deploy later?',
    a: 'Yes. Your progress is kept as a checklist, so you can pause and pick up exactly where you left off.',
  },
]

export default function MarketingQna() {
  return (
    <section className="border-border bg-muted/30 flex h-dvh w-full items-center overflow-hidden border-t px-5 pt-20 pb-24">
      <div className="mx-auto w-full max-w-3xl">
        <Reveal className="text-center">
          <p className="text-caption text-primary tracking-[0.18em] uppercase">QnA</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </Reveal>

        <motion.div
          className="divide-border border-border bg-card mt-12 divide-y rounded-xl border"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {FAQS.map(({ q, a }) => (
            <motion.div key={q} variants={staggerItem}>
              <details className="group px-6 py-5">
                <summary className="text-h2 flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    size={18}
                    className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="text-small text-muted-foreground mt-3">{a}</p>
              </details>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
