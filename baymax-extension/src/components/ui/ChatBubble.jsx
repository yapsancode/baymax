import { cn } from '@/lib/utils'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui'

const md = new MarkdownIt({ html: true })

export function ChatBubble({
  variant = 'ai',
  message,
  timestamp,
  onAction = null,
  actionLabel = 'Start',
  children,
}) {
  const isUser = variant === 'user'
  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'text-body max-w-[85%] px-3 py-2 break-words',
          isUser
            ? 'bg-muted text-foreground rounded-lg rounded-tr-none'
            : 'border-border bg-card text-foreground rounded-lg rounded-tl-none border',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message}</p>
        ) : (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(md.render(message ?? '')),
            }}
          />
        )}
        {!isUser && timestamp && (
          <p className="text-caption text-muted-foreground mt-1">
            {new Date(timestamp)
              .toLocaleString([], { hour: 'numeric', minute: '2-digit', hour12: true })
              .toUpperCase()}
          </p>
        )}
        {onAction && (
          <Button className="mt-2" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
