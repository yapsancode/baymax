import { Card, CardContent, CardHeader } from './Card'
import { Button } from './Button'
import { ChevronLeft, ChevronRight, Clock, Compass, Eye, MousePointerClick, ThumbsDown, Undo2, Volume2, VolumeX } from 'lucide-react'

export function TaskStepCard({
  stepNumber,
  totalSteps,
  title,
  description,
  canAutomate,
  automating,
  onShowMe,
  onDoItForMe,
  voiceEnabled,
  onToggleVoice,
  onThumbsDown,
  feedbackSubmitted,
  feedbackSubmitting,
  voiceRate,
  onCycleVoiceRate,
  statusMessage,
  offTrack,
  onTakeMeBack,
  // Defaults to "Take me back" (the user wandered off the step's page). A step
  // offering its fallbackUrl shortcut passes "Take me there" instead — that
  // jump goes forward to the step's destination, not back.
  takeMeBackLabel = 'Take me back',
  onPrev,
  onNext,
  isFirstStep,
  isLastStep,
}) {
  return (
    <Card className="overflow-hidden pt-0">
      <div className="border-t-primary border-t-4 pt-4">
        <CardHeader className="border-0 pb-2">
          <div className="flex items-center justify-between">
            <p className="text-caption text-primary">
              STEP {stepNumber}
              {totalSteps ? ` OF ${totalSteps}` : ''}: CURRENT TASK
            </p>
            <div className="flex items-center gap-3">
              {onThumbsDown && (
                <button
                  type="button"
                  onClick={onThumbsDown}
                  disabled={feedbackSubmitted || feedbackSubmitting}
                  aria-label={feedbackSubmitted ? 'Feedback recorded' : "Report this step didn't work"}
                  title={feedbackSubmitted ? 'Feedback recorded' : "This step didn't work"}
                  className={
                    feedbackSubmitted
                      ? 'text-danger'
                      : 'text-muted-foreground hover:text-foreground disabled:opacity-60'
                  }
                >
                  <ThumbsDown size={16} fill={feedbackSubmitted ? 'currentColor' : 'none'} />
                </button>
              )}
              {onCycleVoiceRate && voiceEnabled && (
                <button
                  type="button"
                  onClick={onCycleVoiceRate}
                  aria-label="Change voice speed"
                  className="text-caption font-medium text-muted-foreground hover:text-foreground"
                >
                  {voiceRate}x
                </button>
              )}
              {onToggleVoice && (
                <button
                  type="button"
                  onClick={onToggleVoice}
                  aria-label={voiceEnabled ? 'Mute voice guide' : 'Enable voice guide'}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-h2">{title}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-body text-muted-foreground mt-1">{description}</p>
          {!offTrack && (
            <div className="border-border mt-3 flex items-center gap-2 rounded border border-dashed px-3 py-2">
              <Clock size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-caption text-muted-foreground">
                Waiting for you to click the button...
              </span>
            </div>
          )}
          {offTrack && onTakeMeBack ? (
            // Being off the step's page isn't an error — the user just wandered.
            // One calm, informational banner holds the message AND the way back,
            // so nothing on the card reads as a failure state.
            <div className="bg-info-soft mt-3 rounded px-3 py-2">
              <div className="flex items-start gap-2">
                <Compass size={14} className="text-info mt-0.5 flex-shrink-0" />
                <span className="text-caption text-info-foreground">
                  {statusMessage || "You've navigated away from this step's page."}
                </span>
              </div>
              <Button variant="secondary" size="sm" className="mt-2" onClick={onTakeMeBack}>
                <Undo2 size={14} /> {takeMeBackLabel}
              </Button>
            </div>
          ) : (
            (onShowMe || onDoItForMe) && (
              <div className="mt-3 flex gap-2">
                {onShowMe && (
                  <Button variant="outline" size="sm" onClick={onShowMe}>
                    <Eye size={14} /> Show me
                  </Button>
                )}
                {canAutomate && onDoItForMe && (
                  <Button variant="secondary" size="sm" onClick={onDoItForMe} disabled={automating}>
                    <MousePointerClick size={14} /> {automating ? 'Working...' : 'Do it for me'}
                  </Button>
                )}
              </div>
            )
          )}
          {statusMessage && !offTrack && (
            <p className="text-caption text-danger mt-2">{statusMessage}</p>
          )}
          {(onPrev || onNext) && (
            <div className="mt-3 flex justify-between">
              <Button variant="outline" size="sm" onClick={onPrev} disabled={isFirstStep}>
                <ChevronLeft size={14} /> Back
              </Button>
              <Button variant="outline" size="sm" onClick={onNext}>
                {isLastStep ? 'Finish' : 'Next'} <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  )
}
