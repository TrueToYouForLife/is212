import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { SlotClaimPreview } from '../components/SlotClaimPreview'
import { VenueDecisionNotifications } from '../components/VenueDecisionNotifications'
import { VenueReplacementPanel } from '../components/VenueReplacementPanel'
import { daysUntilExpiry, isHoldLive } from '../holdRules'
import { listMyVenueBookings, releaseHold, submitVenueBooking } from '../venueBookingService'
import type { VenueBookingSummary } from '../bookingTypes'

/** AC: the coordinator can view their submitted requests and each one's current status,
 *  convert a hold into a request, and release a hold they no longer need. */
export function MyVenueBookingsPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const [bookings, setBookings] = useState<VenueBookingSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const isCoordinator = profile?.role === 'coordinator'

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listMyVenueBookings()
    if (result.ok) {
      setBookings(result.bookings)
      setError(null)
    } else {
      setBookings(null)
      setError(result.reason)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (userLoading || !isCoordinator) return
    load()
  }, [userLoading, isCoordinator, load])

  const act = async (bookingId: string, action: 'submit' | 'release') => {
    setBusyId(bookingId)
    setActionError(null)
    const result = action === 'submit'
      ? await submitVenueBooking(bookingId)
      : await releaseHold(bookingId)
    if (!result.ok) setActionError(result.reason)
    await load()
    setBusyId(null)
  }

  const now = new Date()

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Event coordinator</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Your venue bookings</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Tentative holds and submitted booking requests, newest first.
        </p>
      </div>

      {userLoading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !isCoordinator ? (
        <Card title="Not available for your role">
          <p className="text-sm text-slate-600">Venue bookings are available to event coordinators.</p>
        </Card>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading your venue bookings…</p>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <Card title="Nothing held yet">
          <p className="text-sm text-slate-600">
            You have not held a venue yet.{' '}
            <Link to="/venues/search" className="font-medium text-indigo-700 hover:underline">Search venues</Link>{' '}
            to place a tentative hold.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {actionError && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {actionError}
            </div>
          )}
          <ul className="space-y-4">
            {bookings.map((booking) => {
              const live = isHoldLive(booking.holdExpiresAt, now)
              return (
                <li key={booking.id}>
                  <Card title={booking.venueName || 'Venue'}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        {booking.eventReference ?? booking.eventName ?? booking.eventId}
                      </p>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    {booking.status === 'held' && booking.holdExpiresAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        {live
                          ? `Expires in ${daysUntilExpiry(booking.holdExpiresAt, now)} day(s) if not submitted.`
                          : 'This hold has expired and its slots have been released.'}
                      </p>
                    )}

                    {booking.reviewNote && (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="text-slate-500">Venue Staff note: </span>{booking.reviewNote}
                      </p>
                    )}

                    {booking.reviewAlternative && (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="text-slate-500">Suggested alternative: </span>{booking.reviewAlternative}
                      </p>
                    )}

                    <div className="mt-4">
                      <p className="mb-2 text-xs text-slate-500">Reserved time ranges (Singapore time)</p>
                      <SlotClaimPreview cells={booking.cells} compact />
                    </div>

                    {(booking.status === 'held' || booking.status === 'pending_approval') && (
                      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                        {booking.status === 'held' && live && (
                          <Button
                            type="button"
                            disabled={busyId === booking.id}
                            onClick={() => act(booking.id, 'submit')}
                          >
                            {busyId === booking.id ? 'Submitting…' : 'Submit for approval'}
                          </Button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === booking.id}
                          onClick={() => act(booking.id, 'release')}
                          className="text-sm font-medium text-red-600 hover:underline disabled:text-slate-400"
                        >
                          Release hold
                        </button>
                      </div>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <VenueDecisionNotifications />
      {!userLoading && isCoordinator && <VenueReplacementPanel key={profile.id} role="coordinator" onChanged={() => void load()} />}
    </PageContainer>
  )
}
