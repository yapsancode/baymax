import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { ChatInput, ChatThread } from '@/components/ui'
import { IdleMascot, ThinkMascot, WorkMascot, ErrorMascot } from '@/components/shared'
import { captureChatPage } from '@/lib/guide'

// Quick-start chips shown above the chat input. Each task id maps to a mock
// guide in App.jsx (TASK_GUIDES).
const SUGGESTIONS = [
  { task: 'backend', label: 'Host a backend using Cloud Run' },
  { task: 'database', label: 'Set up a database using Cloud SQL' },
]

// The sprite beside the chat input, by what the request is doing.
const CHAT_MASCOTS = {
  idle: IdleMascot,
  thinking: ThinkMascot,
  working: WorkMascot,
  error: ErrorMascot,
}

// How long a reply may take before Baymax stops pondering and gets the laptop
// out. Short enough that a slow call visibly changes something, long enough
// that a normal quick reply never triggers it.
const SLOW_REPLY_MS = 2500

// How long the faceplant holds after a failed reply. One full ErrorMascot loop
// is 2.6s, so this reads as a complete beat before settling back to idle.
const ERROR_HOLD_MS = 4000

export default function Home({
  onSelectTask,
  startingTask,
  // A stored guide from the DB (curated or recorded) — real, tested steps.
  onStoredGuide,
  // An AI blueprint — steps the model invented, so they get normalised first.
  onDynamicGuide,
  // Guide fetched by a chip tap — show as a TaskGuideCard in the chat.
  pendingGuide,
  onClearPendingGuide,
  // Page-aware chat preference, owned by App (toggled from the header icon).
  pageShare = false,
}) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [startingGuide, setStartingGuide] = useState(null)

  // Which sprite is showing. Only one timer is ever pending — either the
  // slow-reply timer or the error hold — so a single ref covers both.
  const [mascot, setMascot] = useState('idle')
  const mascotTimer = useRef(null)

  // Drop a pending timer on unmount so a late tick can't set state on a
  // component that is gone.
  useEffect(() => () => clearTimeout(mascotTimer.current), [])

  // A reply is on its way: ponder now, get the laptop out if it drags on. Also
  // cancels an error hold still running from the previous turn.
  const startMascot = () => {
    clearTimeout(mascotTimer.current)
    setMascot('thinking')
    mascotTimer.current = setTimeout(() => setMascot('working'), SLOW_REPLY_MS)
  }

  // The reply landed. On failure hold the faceplant long enough to read.
  const settleMascot = (failed) => {
    clearTimeout(mascotTimer.current)
    setMascot(failed ? 'error' : 'idle')
    if (failed) {
      mascotTimer.current = setTimeout(() => setMascot('idle'), ERROR_HOLD_MS)
    }
  }

  // When App.jsx fetches a guide via a chip tap, it stores it in pendingGuide.
  // Pick it up here and show it as a TaskGuideCard in the chat.
  const pendingGuideRef = useRef(null)
  useEffect(() => {
    if (!pendingGuide || pendingGuide === pendingGuideRef.current) return
    pendingGuideRef.current = pendingGuide
    const id = crypto.randomUUID()
    const guide = pendingGuide
    setMessages((m) => [
      ...m,
      {
        id,
        type: 'taskCard',
        guide,
        variant: 'guide_match',
        starting: false,
        onStart: () => {
          setStartingGuide(id)
          setMessages((msgs) =>
            msgs.map((msg) => (msg.id === id ? { ...msg, starting: true } : msg)),
          )
          onStoredGuide(guide)
        },
        onDismiss: () => setMessages((msgs) => msgs.filter((msg) => msg.id !== id)),
      },
    ])
    onClearPendingGuide()
  }, [pendingGuide, onStoredGuide, onClearPendingGuide])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsgId = crypto.randomUUID()
    const replyMsgId = crypto.randomUUID()

    // Build conversation history from previous messages (cap at 20 turns)
    const chatHistory = messages
      .filter((m) => m.type !== 'typing' && (m.variant === 'user' || m.variant === 'ai'))
      .slice(-20)
      .map((m) => ({
        role: m.variant === 'user' ? 'user' : 'assistant',
        content: m.message,
      }))

    setMessages((m) => [
      ...m,
      { id: userMsgId, variant: 'user', message: text, timestamp: new Date().toISOString() },
    ])
    setInput('')
    setSending(true)
    startMascot()

    const startGuideFromCard = (msgId, guide, variant) => {
      setStartingGuide(msgId)
      setMessages((m) => m.map((msg) => (msg.id === msgId ? { ...msg, starting: true } : msg)))
      const starter = variant === 'guide_match' ? onStoredGuide : onDynamicGuide
      starter(guide)
    }

    const dismissCard = (msgId) => {
      setMessages((m) => m.filter((msg) => msg.id !== msgId))
    }

    setMessages((m) => [
      ...m,
      {
        id: replyMsgId,
        type: 'typing',
        variant: 'ai',
        timestamp: new Date().toISOString(),
      },
    ])

    // Settled in `finally` alongside setSending, so the sprite can never be
    // stranded mid-thought — including by the early return in the dev block.
    let failed = false

    try {
      // TODO: Please remove below when entering production
      // For development only. Uncomment the following to not waste token
      // Remember to comment it back before committing
      // setMessages((m) =>
      //   m.map((msg) =>
      //     msg.id === replyMsgId
      //       ? { ...msg, message: `Robot robot robot robot` }
      //       : msg,
      //   ),
      // )
      // return

      // Grab the page summary + screenshot when the user has page-sharing on.
      // Failure-tolerant: no Console tab / a rate-limited capture yields null and
      // the message just sends page-blind, exactly as before.
      const page = pageShare ? await captureChatPage() : null

      // Second arg: streaming callback — repaint the reply bubble with the
      // accumulated text as tokens arrive (text mode only; blueprints and
      // 'start' confirmations resolve in one go via the final frame).
      const response = await api.sendChat(
        text,
        (partial) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.id === replyMsgId ? { ...msg, type: undefined, message: partial } : msg,
            ),
          ),
        chatHistory,
        null,
        page,
      )

      if (response.type === 'guide_match') {
        const raw = response.data
        const guide = { ...raw, ...(raw.meta || {}) }
        setMessages((m) =>
          m.map((msg) =>
            msg.id === replyMsgId
              ? {
                  ...msg,
                  type: 'taskCard',
                  guide,
                  variant: 'guide_match',
                  starting: false,
                  onStart: () => startGuideFromCard(msg.id, guide, 'guide_match'),
                  onDismiss: () => dismissCard(msg.id),
                }
              : msg,
          ),
        )
      } else if (response.type === 'blueprint_json') {
        const guide = response.data
        setMessages((m) =>
          m.map((msg) =>
            msg.id === replyMsgId
              ? {
                  ...msg,
                  type: 'taskCard',
                  guide,
                  variant: 'blueprint_json',
                  starting: false,
                  onStart: () => startGuideFromCard(msg.id, guide, 'blueprint_json'),
                  onDismiss: () => dismissCard(msg.id),
                }
              : msg,
          ),
        )
      } else {
        // Text mode — onDelta already streamed the text into the bubble; this
        // just settles it to the authoritative final reply.
        setMessages((m) =>
          m.map((msg) =>
            msg.id === replyMsgId ? { ...msg, type: undefined, message: response.data } : msg,
          ),
        )
      }
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === replyMsgId
            ? {
                ...msg,
                type: undefined,
                message: `⚠️ ${err.message || 'Could not reach Baymax. Is the backend running?'}`,
              }
            : msg,
        ),
      )
      failed = true
    } finally {
      setSending(false)
      settleMascot(failed)
    }
  }

  const Mascot = CHAT_MASCOTS[mascot] ?? IdleMascot

  return (
    <div className="flex h-full flex-col">
      {/* <AppHeader /> */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Empty state — hidden once chat starts */}
        {messages.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col p-4 items-center justify-center">
            <div className="flex flex-col items-center">
              <h1 className="text-display text-center shrink-0">What can I help you with today?</h1>
              <IdleMascot size={140} />
            </div>
          </div>
        ) : (
          /* Chat thread — scrollable */
          <div className="flex min-h-0 flex-1 flex-col px-7.5">
            <ChatThread messages={messages} />
          </div>
        )}
      </div>

      {/* Row just above the input: quick-start chips on the left, the pixel
          Baymax on the right. The two are mutually exclusive with the empty
          state — while it's up, the big Idle sprite is the hero and this one
          stays hidden so there's never a second Baymax on screen. Sending adds
          the user's message straight away, so the empty state collapses and
          this sprite arrives already mid-Think.

          Once visible it tracks the request: Idle at rest, Think while a reply
          is coming, Work once it has been slow for a moment, and an Error
          faceplant if it failed. */}
      <div className="flex shrink-0 items-end justify-between gap-2 px-3 pb-1">
        <div className="flex flex-wrap gap-2">
          {messages.length === 0 &&
            SUGGESTIONS.map((s) => (
              <button
                key={s.task}
                type="button"
                disabled={Boolean(startingTask)}
                onClick={() => onSelectTask(s.task)}
                className="border-border bg-card text-caption text-muted-foreground hover:bg-muted hover:text-foreground rounded-full border px-3 py-1.5 transition-colors disabled:cursor-wait disabled:opacity-60"
              >
                {startingTask === s.task ? 'Fetching guide…' : s.label}
              </button>
            ))}
        </div>
        {messages.length > 0 && <Mascot size={72} className="shrink-0" />}
      </div>

      <ChatInput value={input} onChange={setInput} onSend={send} />
    </div>
  )
}
