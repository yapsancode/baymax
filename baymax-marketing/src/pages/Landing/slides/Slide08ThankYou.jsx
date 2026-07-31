import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'
import WanderMascot from '../components/WanderMascot'
import heroPoster from '@/assets/hero.png'
import bgVideo from '@/assets/baymax-background-video.mp4'
import falalaAudio from '@/assets/balalala.mp3'
import googleCloudLogo from '@/assets/google-cloud-logo-white.svg'
import logoGaa from '@/assets/logo-gaa-white.png'
import logoGamuda from '@/assets/logo-gamuda-white.png'

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
}

export default function Slide08ThankYou() {
  const videoRef = useRef(null)
  const playedRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.removeAttribute('autoplay')
      video.pause()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !playedRef.current) {
        playedRef.current = true
        try {
          const audio = new Audio(falalaAudio)
          audio.volume = 0.5
          audio.play()
        } catch {
          // Audio not supported
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
      <div className="bg-background/90 absolute inset-0" />
      <div className="from-background/60 to-background absolute inset-0 bg-gradient-to-b via-transparent" />

      <div className="relative flex h-dvh w-full flex-col items-center justify-center px-5">
        {/* Mascot wanders near the top — absolute so it doesn't shift the text */}
        <motion.div
          className="absolute top-24 left-1/2 flex -translate-x-1/2 justify-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
        >
          <WanderMascot size={180} />
        </motion.div>

        {/* Text sits dead-center in the slide */}
        <motion.div
          className="flex flex-col items-center justify-center text-center"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <SlideItem>
            <SlideEyebrow>Baymax</SlideEyebrow>
            <SlideTitle>Thank you</SlideTitle>
          </SlideItem>

          <SlideItem>
            <p className="text-muted-foreground mx-auto mt-4 text-lg leading-relaxed whitespace-nowrap sm:text-xl lg:text-2xl">
              We&rsquo;d love to hear your thoughts, ideas, and questions.
            </p>
          </SlideItem>
        </motion.div>

        {/* Partner logos — bottom center, white-text variants for visibility */}
        <div className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 sm:bottom-20 sm:gap-6">
          <img
            src={googleCloudLogo}
            alt="Google Cloud"
            className="h-8 w-auto sm:h-10"
          />
          <img
            src={logoGamuda}
            alt="Gamuda"
            className="h-8 w-auto sm:h-10"
          />
          <img
            src={logoGaa}
            alt="Gamuda AI Academy"
            className="h-8 w-auto sm:h-10"
          />
        </div>
      </div>
    </div>
  )
}