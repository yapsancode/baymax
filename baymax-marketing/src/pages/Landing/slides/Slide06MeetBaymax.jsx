// Slide 6 — Meet Baymax. The hero moment: background video under a scrim
// (same treatment as the old landing hero), the Baymax chip, and the
// one-line pitch. The slide unmounts when inactive, so the video never
// plays behind other slides.

import { useEffect, useRef } from 'react'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import baymaxLogo from '@/assets/baymax-logo.svg'
import heroPoster from '@/assets/hero.png'
import bgVideo from '@/assets/baymax-background-video.mp4'

export default function Slide06MeetBaymax() {
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
    <div className="relative h-dvh w-full overflow-hidden">
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
      {/* Flat scrim + fade into the canvas, same as the old hero */}
      <div className="bg-background/60 absolute inset-0" />
      <div className="from-background/60 to-background absolute inset-0 bg-gradient-to-b via-transparent" />

      <SlideShell center className="relative">
        <SlideItem className="flex justify-center">
          <img src={baymaxLogo} alt="Baymax logo" className="h-36 w-36" />
        </SlideItem>
        <SlideItem className="mt-8">
          <SlideEyebrow>Our answer</SlideEyebrow>
          <SlideTitle>
            Meet <span className="text-primary">Baymax</span>.
          </SlideTitle>
        </SlideItem>
        <SlideItem className="mx-auto mt-6 max-w-2xl">
          <p className="text-foreground/90 text-xl sm:text-2xl lg:text-3xl">
            Your navigational co-pilot — sitting right beside you as you navigate a web-based tool.
          </p>
        </SlideItem>
      </SlideShell>
    </div>
  )
}
