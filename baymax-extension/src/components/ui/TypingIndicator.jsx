import { AnimatedTextCycle } from '@/components/shared'

const THINKING_WORDS = ['Thinking', 'Checking guides', 'Almost there']

export function TypingIndicator() {
  return (
    <div className="mb-2 flex items-center">
      <AnimatedTextCycle words={THINKING_WORDS} interval={1800} className="text-caption shimmer-text" />
    </div>
  )
}
