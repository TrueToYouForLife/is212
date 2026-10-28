import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { FEATURES } from '../../../lib/features'
import { loadEventVenueBookings } from '../eventVenueBookingsService'
import { useRequestResource } from '../status/useRequestResource'

const labels = { held: 'Held — not submitted', pending_approval: 'Awaiting Venue Staff',
  confirmed: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', expired: 'Expired' }

export function EventVenueBookings({ eventId, refreshVersion = 0 }: { eventId: string; refreshVersion?: number }) {
  const read = useCallback(() => loadEventVenueBookings(eventId), [eventId])
  const { value, loading, error, refresh } = useRequestResource(`${eventId}:${refreshVersion}`, read)
  return <Card title="All venue bookings" description="Each venue is reviewed separately. Rejected requirements remain outstanding until resolved.">
    <button type="button" onClick={refresh} className="mb-3 text-sm text-indigo-700 underline">Refresh venue bookings</button>
    {loading ? <p role="status">Loading venue bookings…</p> : error ? <p role="alert">{error}</p>
      : !value?.length ? <p>No venue bookings yet.</p> : <ul className="space-y-3">
        {value.map(b => <li key={b.booking_id} className="rounded border p-3">
          <h3 className="font-semibold">{b.venue_name}</h3>
          <p>{labels[b.status]}</p>
          <p>{b.space_layout ? `Layout: ${b.space_layout} · People: ${b.space_attendance}` : 'Legacy booking — requirements recorded on the event.'}</p>
          {b.review_note && <p>Decision note: {b.review_note}</p>}
          {b.review_alternative && <p>Suggested alternative: {b.review_alternative}</p>}
        </li>)}
      </ul>}
    {FEATURES.venueBooking && <Link to="/venues/bookings" className="mt-3 inline-block text-sm text-indigo-700 underline">Manage venue bookings</Link>}
  </Card>
}
