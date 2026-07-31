// Slide 3 — Problem statement. A single beat, centered.

import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'

export default function Slide03Problem() {
  return (
    <SlideShell center>
      <SlideItem>
        <SlideEyebrow>The problem</SlideEyebrow>
      </SlideItem>
      <SlideItem>
        <SlideTitle>
          We&apos;ve all come across a software/tool that has a{' '}
          <span className="text-primary">steep learning curve</span> and is{' '}
          <span className="text-primary">hard to navigate</span>.
        </SlideTitle>
      </SlideItem>
    </SlideShell>
  )
}
