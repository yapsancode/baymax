import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { Button } from './Button'
import { Loader2 } from 'lucide-react'

export function TaskGuideCard({
  guide,
  variant = 'guide_match',
  onStart,
  onDismiss,
  starting = false,
}) {
  const steps = guide?.steps ?? []
  const stepsCount = steps.length
  const isBlueprint = variant === 'blueprint_json'

  return (
    <div className="flex flex-col items-start">
      <Card className="border-border w-full max-w-full rounded-tl-none border ring-0">
        <CardHeader>
          <p className="text-caption text-muted-foreground">
            {isBlueprint ? 'Bluepring' : 'Recorded guide'} &middot; {stepsCount} step
            {stepsCount !== 1 ? 's' : ''}
          </p>
          <CardTitle className="mt-1">
            {isBlueprint ? '\u{1F4CB}' : '\u{1F3AF}'} {guide?.title ?? 'Untitled guide'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stepsCount > 0 && (
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={s.id ?? i} className="text-body text-foreground flex items-start gap-2">
                  <span className="text-caption text-muted-foreground mt-0.5 w-5 flex-shrink-0 text-right tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">{s.title ?? 'Step'}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={onStart} disabled={starting} className="w-full">
              {starting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Starting&hellip;
                </>
              ) : (
                'Start Guided Session'
              )}
            </Button>
            <Button variant="outline" onClick={onDismiss} disabled={starting} className="w-full">
              Continue to Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
