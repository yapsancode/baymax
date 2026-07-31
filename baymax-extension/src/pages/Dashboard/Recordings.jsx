// Admin-only Recordings overview — GET /guides/admin + DELETE /guides/admin/:id.
// The backend 403s non-admins; this page is only reachable via the admin-gated
// sidebar link. Admins can delete any guide and load it straight into the
// extension's Recorder editor via cross-context messaging.

import { useState, useEffect, useMemo } from 'react'
import { Button, Badge, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Loader2, FolderOpen, Trash2 } from 'lucide-react'

const TYPE_FILTERS = [
  { id: 'all', label: 'All', value: null },
  { id: 'official', label: 'Official', value: true },
  { id: 'personal', label: 'Personal', value: false },
]

const PAGE_SIZE = 200

function TypeBadge({ isOfficial }) {
  return (
    <Badge
      className={cn(
        'border-0',
        isOfficial ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
      )}
    >
      {isOfficial ? 'Official' : 'Personal'}
    </Badge>
  )
}

export default function Recordings() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchGuides = (params) => {
    const filter = TYPE_FILTERS.find((f) => f.id === params.typeFilter)
    return api.listAllGuides({
      is_official: filter?.value != null ? String(filter.value) : undefined,
      search: params.search || undefined,
      page_size: PAGE_SIZE,
    })
  }

  useEffect(() => {
    let cancelled = false
    fetchGuides({ typeFilter, search })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [typeFilter, search])

  const refresh = () => {
    setLoading(true)
    setError('')
    fetchGuides({ typeFilter, search })
      .then((data) => setItems(data.items ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  const metrics = useMemo(() => {
    const total = items.length
    const official = items.filter((i) => i.is_official).length
    const personal = total - official
    return { total, official, personal }
  }, [items])

  const handleDelete = async (guide) => {
    const officialWarning = guide.is_official
      ? ' This is an official guide. Re-seed to restore it.'
      : ''
    if (!window.confirm(`Delete "${guide.title}"? Users currently running it will lose access.${officialWarning}`)) {
      return
    }
    try {
      await api.adminDeleteGuide(guide.id)
      setItems((prev) => prev.filter((g) => g.id !== guide.id))
    } catch (e) {
      setError(e.message || 'Could not delete the guide.')
    }
  }

  const handleLoadAndEdit = (guideId) => {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'LOAD_RECORDING', guideId })
    }
  }

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-display">Recordings</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Total guides', metrics.total],
          ['Official', metrics.official],
          ['Personal', metrics.personal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-base font-semibold" title={String(value)}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={cn(
                'text-caption rounded-full px-4 py-1.5 transition-colors',
                typeFilter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-border',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Input
          placeholder="Search guide title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-400" />
            <p className="mt-4 text-gray-600">Loading recordings...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-destructive">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-gray-600">No recordings yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-small">
            <thead className="bg-muted text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Steps</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Updated</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2">{row.title}</td>
                  <td className="px-4 py-2">
                    <TypeBadge isOfficial={row.is_official} />
                  </td>
                  <td className="px-4 py-2">{row.step_count}</td>
                  <td className="px-4 py-2">{row.user_email ?? '—'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(row.updated_at || row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleLoadAndEdit(row.id)}
                      >
                        <FolderOpen size={14} /> Load & edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
