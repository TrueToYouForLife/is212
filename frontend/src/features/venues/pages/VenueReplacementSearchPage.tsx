import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { useVenueReplacements } from '../useVenueReplacements'
import { ReplacementVenueSearch } from '../components/ReplacementVenueSearch'

function ReplacementSearch({ bookingId }: { bookingId: string }) {
  const { data, loading, error, reload } = useVenueReplacements()
  const [busy, setBusy] = useState(false)
  const source = data?.sources.find(booking => booking.id === bookingId)
  const pending = data?.requests.some(request => request.originalBookingId === bookingId && request.status === 'pending')
  return <Card title="Find a replacement venue">
    <div className="space-y-4">
      <Link className="text-indigo-700 hover:underline" to="/venues/bookings">Back to your venue bookings</Link>
      <Button type="button" disabled={loading || busy} onClick={() => void reload()}>Reload booking and search</Button>
      {loading && <p role="status">Loading affected booking…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {data && !source && <p role="alert">{pending
        ? 'A replacement request is already pending. Open your bookings to review or withdraw it.'
        : 'This booking is no longer eligible for a replacement, or is not assigned to you. Open your bookings to check its current status.'}</p>}
      {source && <>
        <h2 className="font-semibold">{source.eventName} — {source.venueName}</h2>
        <p className="font-semibold text-amber-800">Needs replacement</p>
        <ul>{source.reasons.map(reason => <li key={`${reason.store}-${reason.id}`}>{reason.detail}</li>)}</ul>
        <p>Event time (Singapore): {formatDateTime(source.details.proposedStart)} to {formatDateTime(source.details.proposedEnd)}.</p>
        <p>Attendance: {source.details.expectedAttendance ?? 'Not specified'}. Layout: {source.details.layoutPreference ?? 'No preference'}.</p>
        <p>The event’s full date and time are kept for this search. No event details are changed when adjusting venue filters.</p>
        <ReplacementVenueSearch key={`${source.id}-${source.version}`} source={source} onBusyChange={setBusy} />
      </>}
    </div>
  </Card>
}

export function VenueReplacementSearchPage() {
  const { profile, loading } = useCurrentUser()
  const { bookingId = '' } = useParams()
  return <PageContainer>
    {loading ? <p>Checking your session…</p>
      : profile?.role !== 'coordinator' ? <Card title="Venue replacements">Only Event Coordinators can request a replacement venue.</Card>
        : !z.string().uuid().safeParse(bookingId).success ? <p role="alert">The booking link is invalid. Open your venue bookings and choose an affected booking.</p>
          : <ReplacementSearch key={`${profile.id}-${bookingId}`} bookingId={bookingId} />}
  </PageContainer>
}
