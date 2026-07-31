// Slide 1 — Team intro. "Hi everyone! We are team Penta."
// The Baymax background video runs behind the intro (same treatment as the
// Meet-Baymax slide: video + scrim + gradient), so the deck opens on brand.

import { useEffect, useRef } from 'react'
import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import heroPoster from '@/assets/hero.png'
import pentaLogo from '@/assets/Penta-V-logo.png'
import bgVideo from '@/assets/baymax-background-video.mp4'

const TEAM = ['Annabelle', 'Aidi', 'Benny', 'Kuberan', 'Reagan', 'Isyraf']

export default function Slide01Team() {
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
      {/* Flat scrim + fade into the canvas, same as slide 6 */}
      <div className="bg-background/60 absolute inset-0" />
      <div className="from-background/60 to-background absolute inset-0 bg-gradient-to-b via-transparent" />

      <SlideShell center className="relative">
        <SlideItem className="flex justify-center">
          <img src={pentaLogo} alt="Penta-V logo" className="h-28 w-28 rounded-lg object-cover" />
        </SlideItem>

        <SlideItem className="mt-6">
          <SlideEyebrow>Hi everyone</SlideEyebrow>
          <SlideTitle className="text-3xl sm:text-4xl lg:text-5xl">
            Building a Chrome Extension for Real-Time Website Guidance
          </SlideTitle>
          <p className="text-white mx-auto mt-6 max-w-2xl text-center text-xl sm:text-2xl lg:text-3xl">
            by Team Penta
          </p>
        </SlideItem>

        <SlideItem className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {TEAM.map((name) => (
            <span
              key={name}
              className="border-border bg-card text-foreground rounded-full border px-5 py-2 text-base sm:text-lg"
            >
              {name}
            </span>
          ))}
        </SlideItem>
      </SlideShell>
    </div>
  )
}
