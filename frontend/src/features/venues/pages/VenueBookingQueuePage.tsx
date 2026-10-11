import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { listPendingVenueBookings } from '../venueBookingQueueService'
import type { PendingVenueBooking } from '../venueBookingQueueService'

export function VenueBookingQueuePage() {
  const { profile, loading: sessionLoading } = useCurrentUser()
  const allowed = profile?.role === 'venue_staff'
  const [bookings, setBookings] = useState<PendingVenueBooking[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setBookings(null)
    setError(null)
    const result = await listPendingVenueBookings()
    if (request !== sequence.current) return
    if (result.ok) setBookings(result.bookings)
    else setError(result.reason)
    setLoading(false)
  }, [])
  useEffect(() => {
    if (!sessionLoading && allowed) void load()
    return () => { sequence.current += 1 }
  }, [sessionLoading, allowed, profile?.id, load])

  if (sessionLoading) return <p>Checking your session…</p>
  if (!allowed) return <Card title="Booking requests">Only Venue Staff can review venue bookings.</Card>
  return <PageContainer>
    <Card title="Pending venue bookings">
      <div className="space-y-4">
        {loading && <p role="status">Loading booking requests…</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {bookings?.length === 0 && <p>No bookings are awaiting review.</p>}
        {bookings && bookings.length > 0 && <ul className="divide-y divide-slate-200">
          {bookings.map((booking) => <li key={booking.id} className="space-y-2 py-3">
            <p className="font-semibold">{booking.venueName}</p>
            <p className="text-sm text-slate-500">Created {formatDateTime(booking.createdAt)}</p>
            <Link className="text-indigo-700 hover:underline" to={`/venues/bookings/${booking.id}/review`}>
              Review booking at {booking.venueName}
            </Link>
          </li>)}
        </ul>}
        <Button type="button" disabled={loading} onClick={() => void load()}>Reload requests</Button>
      </div>
    </Card>
  </PageContainer>
}
