// Marketing slide — the original landing hero, adapted for the deck: same
// video + scrim + copy, minus the scroll parallax. "See how it works" now
// advances to the next slide instead of an anchor link.

import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { Reveal } from '@/pages/Landing/components/Reveal'
import heroPoster from '@/assets/hero.png'
import bgVideo from '@/assets/baymax-background-video.mp4'

export default function MarketingHero({ onGetStarted, onNext }) {
  const videoRef = useRef(null)

  // Respect reduced motion: freeze on the poster frame instead of playing.
  useEffect(() => {
    const video = videoRef.current
    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.removeAttribute('autoplay')
      video.pause()
    }
  }, [])

  return (
    <section className="relative h-dvh w-full overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={bgVideo}
        poster={heroPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {/* Flat scrim for text contrast */}
      <div className="bg-background/55 absolute inset-0" />
      {/* Gradient: darken under the nav, fade cleanly into the canvas below */}
      <div className="from-background/50 to-background absolute inset-0 bg-gradient-to-b via-transparent" />

      <div className="relative flex h-full items-center justify-center">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <p className="text-caption text-primary tracking-[0.18em] uppercase">
              Deploy to Google Cloud with confidence
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tighter sm:text-5xl lg:text-6xl">
              No need to worry when you deploy your code
            </h1>
            <p className="text-body text-muted-foreground mx-auto mt-5 max-w-xl sm:text-lg">
              Baymax walks you through every deployment to Google Cloud — one clear, calm step at a
              time.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="default" size="lg" onClick={onGetStarted}>
                Get started
                <ArrowRight size={18} className="ml-1.5" />
              </Button>
              <Button variant="secondary" size="lg" onClick={onNext}>
                See how it works
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
