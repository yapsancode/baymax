// Dashboard Task History — backed by the real backend (GET /sessions).
// The "Create test session" button exercises POST /sessions from the UI.
// Note: backend sessions don't carry status/progress yet, so they all render
// as "In Progress" for now.

import { useState, useEffect, useCallback } from 'react'
import { TaskCard, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Loader2 } from 'lucide-react'

const FILTERS = [
  { id: 'all', label: 'All Tasks' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
]

function toCard(session) {
  const progress =
    session.total_steps > 0 ? Math.round((session.completed_steps / session.total_steps) * 100) : 0
  return {
    id: session.id,
    task: session.task ?? 'frontend',
    label: session.title,
    status: session.status,
    progress,
  }
}

export default function History() {
  const [filter, setFilter] = useState('all')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listSessions()
      setSessions([...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDeleteSession = async (sessionId) => {
    await api.deleteSession(sessionId)
  }

  useEffect(() => {
    load()
  }, [load])

  const cards = sessions.map(toCard)
  const tasks = filter === 'all' ? cards : cards.filter((card) => card.status === filter)

  if (loading) {
    return (
      <div className="flex h-full max-w-full flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-display">Task History</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-400" />
            <p className="mt-4 text-gray-600">Loading sessions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full max-w-full flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-display">Task History</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full max-w-full flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-display">Task History</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">No sessions yet.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-display">Task History</h1>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((filterOption) => (
          <button
            key={filterOption.id}
            onClick={() => setFilter(filterOption.id)}
            className={cn(
              'text-caption rounded-full px-4 py-1.5 transition-colors',
              filter === filterOption.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-border',
            )}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tasks.map((card) => (
          <TaskCard
            key={card.id}
            {...card}
            onResume={() => {
              if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'RESUME_SESSION', session: card })
              }
            }}
            onDelete={() => handleDeleteSession(card.id)}
            onDeleted={() => load()}
          />
        ))}
      </div>
    </div>
  )
}
