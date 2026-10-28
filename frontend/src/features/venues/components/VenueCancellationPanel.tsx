import { useEffect, useState } from 'react'
import { cancelVenueBooking, getVenueCancellation } from '../venueCancellationService'
import type { CancellationContext } from '../venueCancellationService'

const date = new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' })
export function VenueCancellationPanel({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const [context, setContext] = useState<CancellationContext | null>(null)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    let active = true
    setContext(null)
    void getVenueCancellation(bookingId).then(value => {
      if (!active) return
      setContext(value)
      setError(value ? '' : 'Cancellation details could not be loaded.')
      setLocked(!value)
    })
    return () => { active = false }
  }, [bookingId, revision])
  const cancel = async () => {
    if (!context || !reason.trim() || busy || locked) return
    setBusy(true)
    const result = await cancelVenueBooking(bookingId, reason, context.version)
    setBusy(false)
    if (!result.ok) { setError(result.reason); setLocked(true); return }
    setOpen(false)
    setRevision(v => v + 1)
    onChanged()
  }
  return <div className="mt-4 space-y-2">
    {error && <p role="alert">{error}</p>}
    {context?.audit ? <p>Cancelled by {context.audit.actor_name} on {date.format(new Date(context.audit.cancelled_at))} (Singapore time). Reason: {context.audit.reason}</p>
      : context && ['pending_approval','confirmed','rejected'].includes(context.status) && <>
        <button type="button" className="text-red-700 underline" disabled={busy} onClick={() => setOpen(!open)}>Cancel booking</button>
        {open && <div>
          <p>Current booking status: {context.status === 'confirmed' ? 'Approved' : context.status === 'pending_approval' ? 'Awaiting Venue Staff' : 'Rejected'}</p>
          <p>This cancels only this venue booking. Other bookings and the event remain unchanged.</p>
          <label>Cancellation reason<textarea aria-label="Cancellation reason" value={reason} disabled={busy}
            onChange={e => setReason(e.target.value)} className="block w-full rounded border p-2" /></label>
          <button type="button" onClick={() => void cancel()} disabled={busy || locked || !reason.trim()} className="text-red-700 underline disabled:opacity-50">
            {busy ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </div>}
      </>}
    {error && <button type="button" disabled={busy} onClick={() => setRevision(v => v + 1)}>Reload cancellation details</button>}
  </div>
}
