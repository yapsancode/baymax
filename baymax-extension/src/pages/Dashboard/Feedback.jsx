// Admin-only Feedback overview — GET /feedback. The backend already 403s any
// non-admin caller (require_admin in services/auth_service.py); this page
// assumes it's only reachable via the admin-gated sidebar link (Layout.jsx),
// but doesn't rely on that for security.
//
// Structured after History.jsx's load/loading/error/empty pattern. Fetches a
// single generously-sized page and derives the summary metrics + guide filter
// options client-side from it — feedback volume at this project's scale
// doesn't need true server-side aggregation yet.

import { useState, useEffect, useMemo } from 'react'
import { Badge, Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Loader2, Trash2, Copy, Check } from 'lucide-react'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'success', label: 'Success' },
  { id: 'fail', label: 'Fail' },
]

const PAGE_SIZE = 200

function OutcomeBadge({ status }) {
  return (
    <Badge
      className={cn(
        'border-0',
        status === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
      )}
    >
      {status === 'success' ? 'Success' : 'Fail'}
    </Badge>
  )
}

export default function Feedback() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [guideFilter, setGuideFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedLabel, setCopiedLabel] = useState(null)

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(String(text))
      setCopiedLabel(label)
      setTimeout(() => setCopiedLabel(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const fetchFeedback = (params) =>
    api.listFeedback({
      status: params.statusFilter === 'all' ? undefined : params.statusFilter,
      guide_title: params.search || undefined,
      page_size: PAGE_SIZE,
    })

  useEffect(() => {
    let cancelled = false
    fetchFeedback({ statusFilter, search })
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
  }, [statusFilter, search])

  const refresh = () => {
    setLoading(true)
    setError('')
    fetchFeedback({ statusFilter, search })
      .then((data) => setItems(data.items ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete feedback for "${row.guide_title}" — Step ${row.step_index}: ${row.step_title}? Please ensure the issue is resolved before deleting.`,
      )
    ) {
      return
    }
    try {
      await api.adminDeleteFeedback(row.id)
      setItems((prev) => prev.filter((i) => i.id !== row.id))
    } catch (e) {
      setError(e.message || 'Could not delete the feedback.')
    }
  }

  const guides = useMemo(
    () => [...new Set(items.map((i) => i.guide_title))].sort(),
    [items],
  )

  const rows = guideFilter === 'all' ? items : items.filter((i) => i.guide_title === guideFilter)

  const metrics = useMemo(() => {
    const successCount = rows.filter((i) => i.status === 'success').length
    const failCount = rows.filter((i) => i.status === 'fail').length
    const total = successCount + failCount

    const failByGuide = new Map()
    const failByStep = new Map()
    for (const row of rows) {
      if (row.status !== 'fail') continue
      failByGuide.set(row.guide_title, (failByGuide.get(row.guide_title) || 0) + 1)
      const stepKey = `${row.guide_title} — Step ${row.step_index}: ${row.step_title}`
      failByStep.set(stepKey, (failByStep.get(stepKey) || 0) + 1)
    }
    const topOf = (map) =>
      [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    return {
      total,
      successCount,
      failCount,
      successRate: total ? Math.round((successCount / total) * 100) : 0,
      mostFailedGuide: topOf(failByGuide),
      mostFailedStep: topOf(failByStep),
    }
  }, [rows])

  return (
    <div className="max-w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-display">Feedback</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: 'Total events', value: metrics.total },
          { label: 'Successful', value: metrics.successCount },
          { label: 'Failed', value: metrics.failCount },
          { label: 'Success rate', value: `${metrics.successRate}%` },
          { label: 'Most-failed guide', value: metrics.mostFailedGuide, copyable: true },
          { label: 'Most-failed step', value: metrics.mostFailedStep },
        ].map(({ label, value, copyable }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="break-words text-base font-semibold" title={String(value)}>
                {value}
              </p>
              {copyable && value && value !== '—' && (
                <button
                  onClick={() => handleCopy(value, label)}
                  className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
                  aria-label="Copy most-failed guide"
                  title="Copy"
                >
                  {copiedLabel === label ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                'text-caption rounded-full px-4 py-1.5 transition-colors',
                statusFilter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-border',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={guideFilter}
          onChange={(e) => setGuideFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-small"
        >
          <option value="all">All guides</option>
          {guides.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

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
            <p className="mt-4 text-gray-600">Loading feedback...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-destructive">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-gray-600">No feedback yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-small">
            <thead className="bg-muted text-caption text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Guide</th>
                <th className="px-4 py-2 font-medium">Step</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Session</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{row.guide_title}</td>
                  <td className="px-4 py-2">
                    {row.step_index}. {row.step_title}
                  </td>
                  <td className="px-4 py-2">
                    <OutcomeBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2">{row.user_email ?? row.user_id}</td>
                  <td className="px-4 py-2 font-mono text-caption text-muted-foreground">
                    {row.session_id ? row.session_id.slice(0, 8) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 size={14} /> Delete
                    </Button>
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
