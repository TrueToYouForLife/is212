import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { formatDateTime } from '../formatters'
import { auditChanges, auditNote, auditTitle } from './auditDescription'
import { getEventAuditTrail } from './auditService'
import type { AuditEntry } from './types'

/**
 * US34: the event's audit trail for its assigned Coordinator and the Coordinator Lead, oldest
 * first. Read again when the page refreshes after a change, so a decision made here shows up
 * without reloading. No polling: the page's Refresh control covers actions by other users.
 */
export function AuditTrailCard({ eventId, refreshVersion = 0 }: { eventId: string; refreshVersion?: number }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getEventAuditTrail(eventId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setEntries(result.entries)
        setError(null)
      } else {
        setError(result.reason)
      }
    })
    return () => { cancelled = true }
  }, [eventId, refreshVersion])

  return (
    <Card title="Audit trail" description="Who did what to this event, and when. Records cannot be edited or deleted.">
      {error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : !entries ? (
        <p className="text-sm text-slate-500">Loading audit trail…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No actions have been recorded for this event yet.</p>
      ) : (
        <ol aria-label="Audit trail" className="space-y-4">
          {entries.map((entry) => {
            const note = auditNote(entry)
            const changes = auditChanges(entry)
            return (
              <li key={entry.id} className="border-l-2 border-slate-200 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{auditTitle(entry.action)}</span>
                  <span className="text-sm text-slate-700">by {entry.actorName ?? 'the system'}</span>
                  <time dateTime={entry.occurredAt} className="text-xs text-slate-500">
                    {formatDateTime(entry.occurredAt)}
                  </time>
                </div>
                {(changes.length > 0 || note) && (
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                    {changes.map((line) => <li key={line}>{line}</li>)}
                    {note && <li>Note: {note}</li>}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
