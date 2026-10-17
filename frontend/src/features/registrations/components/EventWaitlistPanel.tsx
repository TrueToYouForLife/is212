import { useCallback, useRef, useState } from 'react'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import { formatDateTime } from '../../events/formatters'
import { useRequestResource } from '../../events/status/useRequestResource'
import { loadEventWaitlist, moveWaitlistEntry } from '../waitlistManagementService'
import type { ManagedWaitlistEntry, WaitlistMove } from '../types'
import { availableMoves } from '../validation'

const MOVES: { move: WaitlistMove; label: string }[] = [
  { move: 'front', label: 'Move to front' },
  { move: 'up', label: 'Move up' },
  { move: 'down', label: 'Move down' },
]

function describe(entry: ManagedWaitlistEntry): string {
  if (entry.status === 'waiting') return `Position ${entry.position}`
  if (entry.status === 'offered') return `Offered a place until ${formatDateTime(entry.offerExpiresAt)}`
  return 'Offer expired'
}

/**
 * US16 SCRUM-154: the assigned Coordinator's view of an event's waiting list, with the manual
 * override of its first-come-first-served order. Only people still waiting can be moved; someone
 * holding an offered place is shown first and is not part of the queue.
 */
export function EventWaitlistPanel({ eventId }: { eventId: string }) {
  const read = useCallback(() => loadEventWaitlist(eventId), [eventId])
  const { value: entries, error, refresh } = useRequestResource(`event-waitlist:${eventId}`, read)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // A ref, not the state: two clicks in the same tick both see the state as unset.
  const inFlight = useRef(false)

  async function move(entryId: string, direction: WaitlistMove) {
    if (inFlight.current) return
    inFlight.current = true
    setPendingId(entryId)
    setMessage(null)
    const result = await moveWaitlistEntry(entryId, direction)
    inFlight.current = false
    setPendingId(null)
    if (!result.ok) setMessage(result.reason)
    // Reload after a stale refusal too, so the Coordinator sees the list as it really is.
    if (result.ok || result.stale) refresh()
  }

  if (error) return <ErrorAlert onRetry={refresh}>{error}</ErrorAlert>
  if (!entries) return <p className="text-sm text-slate-500">Loading the waiting list…</p>
  if (entries.length === 0) return <p className="text-sm text-slate-600">No one is on the waiting list.</p>

  return (
    <div className="space-y-3">
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      <ul className="divide-y divide-slate-100">
        {entries.map((entry) => {
          const allowed = availableMoves(entries, entry.entryId)
          return (
            <li key={entry.entryId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{entry.attendeeName}</p>
                <p className="text-xs text-slate-500">
                  {describe(entry)} · joined {formatDateTime(entry.joinedAt)}
                </p>
              </div>
              {entry.status === 'waiting' && (
                <div className="flex flex-wrap gap-2">
                  {MOVES.map(({ move: direction, label }) => (
                    <button key={direction} type="button" aria-label={`${label}: ${entry.attendeeName}`}
                      disabled={!allowed[direction] || pendingId !== null}
                      onClick={() => void move(entry.entryId, direction)}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
