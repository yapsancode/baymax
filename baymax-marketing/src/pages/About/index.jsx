// About page — the marketing site, as a scrolling page. The five original
// marketing sections (formerly the back half of the pitch deck) live here:
// hero → the About story → features → how-it-works → QnA → CTA/footer.
// "See how it works" smooth-scrolls to the how-it-works section.

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandingSiteNav, useLandingScroll } from '@/components/shared'
import MarketingHero from './MarketingHero'
import MarketingFeatures from './MarketingFeatures'
import MarketingHowItWorks from './MarketingHowItWorks'
import MarketingQna from './MarketingQna'
import MarketingCta from './MarketingCta'

export default function AboutPage() {
  const navigate = useNavigate()
  const { hidden, onScroll } = useLandingScroll()
  const goHome = () => navigate('/')
  const howItWorksRef = useRef(null)

  return (
    <div
      className="landing bg-background text-foreground h-screen w-full overflow-y-auto scroll-smooth"
      onScroll={onScroll}
    >
      <LandingSiteNav hidden={hidden} onGetStarted={goHome} />

      <MarketingHero
        onGetStarted={goHome}
        onNext={() => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="text-caption text-primary tracking-[0.18em] uppercase">About</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your calm deployment companion
        </h1>
        <p className="text-body text-muted-foreground mt-5">
          Baymax was built on a simple idea: shipping to the cloud shouldn't be stressful. Inspired
          by a personal healthcare companion, it stays patient, explains every step in plain
          language, and never lets a detail slip — so deploying feels less like defusing a bomb and
          more like following a friend's advice.
        </p>
      </main>

      <MarketingFeatures />

      <div ref={howItWorksRef}>
        <MarketingHowItWorks />
      </div>

      <MarketingQna />

      <MarketingCta onGetStarted={goHome} />
    </div>
  )
}
