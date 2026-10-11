import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { VenueBookingRejectionForm } from '../components/VenueBookingRejectionForm'
import { VenueBookingRequestDetails } from '../components/VenueBookingRequestDetails'
import { VenueBookingConflicts } from '../components/VenueBookingConflicts'
import { getVenueBookingReview } from '../venueBookingReviewService'
import type { VenueBookingReview } from '../venueBookingReviewService'

/** Slice 1 decision page; Slice 2 supplies its pending-queue navigation and details. */
export function VenueBookingReviewPage() {
  const { bookingId = '' } = useParams()
  const { profile, loading: sessionLoading } = useCurrentUser()
  const canReview = profile?.role === 'venue_staff'
  const [booking, setBooking] = useState<VenueBookingReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setBooking(null)
    setError(null)
    const result = await getVenueBookingReview(bookingId)
    if (request !== sequence.current) return
    if (result.ok) setBooking(result.booking)
    else setError(result.reason)
    setLoading(false)
  }, [bookingId])

  useEffect(() => {
    setSaved(false)
    if (!sessionLoading && canReview) void load()
    return () => { sequence.current += 1 }
  }, [sessionLoading, canReview, profile?.id, load])

  if (sessionLoading) return <p>Checking your session…</p>
  if (!canReview) return <Card title="Venue booking review">Only Venue Staff can review venue bookings.</Card>

  return <PageContainer>
    <Card title="Venue booking review">
      <div className="space-y-4">
        {saved && <p role="status">Booking rejected.</p>}
        {loading && <p>Loading booking…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {booking && <>
          <h2 className="text-lg font-semibold">{booking.venueName}</h2>
          <BookingStatusBadge status={booking.status} />
          {booking.details && <VenueBookingRequestDetails details={booking.details} />}
          {booking.details && <VenueBookingConflicts booking={booking} />}
          {booking.reviewNote && <p>{booking.reviewNote}</p>}
          {booking.reviewAlternative && <div><p className="text-sm text-slate-500">Suggested alternative</p><p>{booking.reviewAlternative}</p></div>}
          {booking.reviewedAt && <p className="text-sm text-slate-500">Reviewed at {formatDateTime(booking.reviewedAt)}</p>}
          {booking.reviewedBy && <p className="text-sm text-slate-500">Reviewer ID: {booking.reviewedBy}</p>}
          <VenueBookingRejectionForm key={booking.id} bookingId={booking.id} status={booking.status}
            onRejected={() => { setSaved(true); void load() }} />
        </>}
        <Button type="button" disabled={loading} onClick={() => { setSaved(false); void load() }}>Reload booking</Button>
        <p className="text-xs text-slate-500">Reloading discards unsaved input.</p>
      </div>
    </Card>
  </PageContainer>
}
