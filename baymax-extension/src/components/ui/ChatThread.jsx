import { ScrollArea, ChatBubble, TaskGuideCard, TypingIndicator } from '@/components/ui/'
import { useRef, useEffect } from 'react'

export function ChatThread({ messages }) {
  const scrollContainerRef = useRef(null)

  // Auto-scroll when messages change or generating state changes
  useEffect(() => {
    setTimeout(scrollContainerRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mt-6 mb-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id}>
            {m.type === 'taskCard' ? (
              <TaskGuideCard
                guide={m.guide}
                variant={m.variant}
                onStart={m.onStart}
                onDismiss={m.onDismiss}
                starting={m.starting}
              />
            ) : m.type === 'typing' ? (
              <TypingIndicator />
            ) : (
              <ChatBubble
                variant={m.variant}
                message={m.message}
                timestamp={m.timestamp}
                onAction={m.onAction}
                actionLabel={m.actionLabel}
              />
            )}
          </div>
        ))}
        <div ref={scrollContainerRef} />
      </div>
    </ScrollArea>
  )
}
