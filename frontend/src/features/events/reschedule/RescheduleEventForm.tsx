import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { rescheduleEvent } from './rescheduleService'
import type { EventStatus } from '../types'

/** A datetime-local value is the Coordinator's local time; the database stores an instant. */
function toInstant(value: string): string {
  return new Date(value).toISOString()
}

/**
 * US21 AC-021.1, AC-021.2, AC-021.4: the Coordinator gives the event a new date. Its bookings
 * are kept and flagged for review, and registered attendees are told the new time (0122).
 */
export function RescheduleEventForm({ eventId, onRescheduled }: {
  eventId: string
  onRescheduled: (status: EventStatus) => void
}) {
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!startsAt || !endsAt) {
      setError('Choose the new start and end.')
      return
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('The new end must be after the new start.')
      return
    }
    setError(null)
    setSaving(true)
    const result = await rescheduleEvent(eventId, toInstant(startsAt), toInstant(endsAt), reason)
    setSaving(false)
    if (result.ok) {
      setStartsAt('')
      setEndsAt('')
      setReason('')
      onRescheduled(result.status)
    } else {
      setError(result.reason)
    }
  }

  return (
    <form
      aria-label="Reschedule event"
      className="mt-6 space-y-3 border-t border-slate-200 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h3 className="text-sm font-semibold text-slate-900">Reschedule</h3>
      <p className="text-sm text-slate-600">
        The event returns to Planning with the new date. Its bookings are kept and flagged for you to check,
        and registered attendees are told the new time.
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="block text-slate-600">New start</span>
          <input type="datetime-local" className="mt-1 rounded border border-slate-300 p-2 text-sm"
            value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">New end</span>
          <input type="datetime-local" className="mt-1 rounded border border-slate-300 p-2 text-sm"
            value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-slate-600">Reason (optional)</span>
        <input type="text" className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
          value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Rescheduling…' : 'Reschedule event'}</Button>
    </form>
  )
}
