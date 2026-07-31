// Slide 5 — Our intent: the guiding question. A single centered beat.

import { SlideShell, SlideItem, SlideEyebrow, SlideTitle } from '../components/SlideShell'

export default function Slide05GuidingQuestion() {
  return (
    <SlideShell center>
      <SlideItem>
        <SlideEyebrow>Our guiding question</SlideEyebrow>
      </SlideItem>
      <SlideItem>
        <SlideTitle>
          How can we reduce the <span className="text-primary">friction</span> in this workflow with
          AI?
        </SlideTitle>
      </SlideItem>
    </SlideShell>
  )
}
