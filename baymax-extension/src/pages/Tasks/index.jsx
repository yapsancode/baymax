// Tasks screen — list of deployment tasks and their progress.
//a;slfkj

import { TaskCard, ScrollArea } from '@/components/ui'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Tasks({ onResumeSession }) {
  const [sessionsList, setSessionsList] = useState([])
  const [sessionsListLoading, setSessionsListLoading] = useState(false)

  // Load session list from backend
  const fetchSessions = () => {
    setSessionsListLoading(true)
    api
      .listSessions()
      .then((data) => {
        const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        setSessionsList(sorted)
      })
      .catch((err) => {
        console.error('Failed to load sessions:', err.message)
      })
      .finally(() => setSessionsListLoading(false))
  }

  const handleDeleteSession = async (sessionId) => {
    await api.deleteSession(sessionId)
  }

  // Wait for a valid Supabase session before fetching — on fresh logins the
  // access token may still be refreshing, causing a 401 on the first request.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) fetchSessions()
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        fetchSessions()
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (sessionsListLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-7.5 pb-0">
          <h1 className="text-h1">Ongoing Tasks</h1>
          <p>Track your deployment milestones and progress</p>
          <div className="flex h-full flex-1 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-600">Loading sessions...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionsListLoading && sessionsList.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-7.5 pb-0">
          <h1 className="text-h1">Ongoing Tasks</h1>
          <p>Track your deployment milestones and progress</p>
          <div className="flex h-full flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600">No sessions yet.</p>
              <p className="mt-2 text-gray-600">Start a new task to get started.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-7.5 pb-0">
        <h1 className="text-h1">Ongoing Tasks</h1>
        <p>Track your deployment milestones and progress</p>

        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <div className="flex w-full min-w-0 flex-col gap-3 pb-4">
            {sessionsList.map((session) => (
              <TaskCard
                key={session.id}
                {...session}
                task={session.task ?? 'frontend'}
                label={session.title}
                status={session.status}
                progress={
                  session.total_steps > 0
                    ? Math.round((session.completed_steps / session.total_steps) * 100)
                    : 0
                }
                onResume={() => onResumeSession({ ...session, task: session.task ?? 'frontend' })}
                //new
                onDelete={() => handleDeleteSession(session.id)}
                onDeleted={() => fetchSessions()}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
