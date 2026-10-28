import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { useCurrentUser } from '../../auth/sessionContext'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import { listMyFlaggedBookings } from '../venueAlertService'
import type { FlaggedBooking, PreviewCell } from '../venueBlockTypes'

// Venues are in Singapore, so times are shown there whatever the viewer's timezone.
const FLAGGED_AT = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
})

const KIND_LABELS: Record<PreviewCell['kind'], string> = {
  event: 'event',
  buffer: 'setup or turnaround',
}

function describeCell(cell: PreviewCell): string {
  return `${formatPlainDate(cell.date)} ${SLOT_SHORT_LABELS[cell.slot]} (${KIND_LABELS[cell.kind]})`
}

/**
 * US12, AC-012.8: a coordinator's bookings that a venue block has flagged. Week 7 change 2:
 * the booking is kept, and the coordinator arranges an alternative.
 */
export function FlaggedBookingsPage() {
  const { profile, loading } = useCurrentUser()
  const isCoordinator = profile?.role === 'coordinator'

  const [flags, setFlags] = useState<FlaggedBooking[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCoordinator) return
    void listMyFlaggedBookings().then((result) => {
      if (result.ok) {
        setFlags(result.value)
      } else {
        setFlags(null)
        setError(result.reason)
      }
    })
  }, [isCoordinator])

  if (loading) return null

  if (!isCoordinator) {
    return (
      <Card title="Venue alerts">
        <p className="text-sm text-slate-600">Venue alerts are available to Event Coordinators.</p>
      </Card>
    )
  }

  return (
    <Card title="Venue alerts">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          These bookings overlap a period Venue Staff have blocked. They have not been cancelled, but they
          can&apos;t be approved while flagged. Arrange another venue, or cancel the booking.
        </p>

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {flags && flags.length === 0 && (
          <p className="text-sm text-slate-500">No venue alerts. None of your bookings overlap a venue block.</p>
        )}

        {flags && flags.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {flags.map((flag) => (
              <li key={flag.id} className="space-y-1 px-4 py-3">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-slate-900">{flag.eventReference ?? 'Event'}</span>
                  <span className="text-slate-700">{flag.eventName ?? 'Untitled event'}</span>
                  <span className="text-slate-500">at</span>
                  <span className="text-slate-700">{flag.venueName}</span>
                </p>
                <p className="text-sm text-slate-700">{flag.detail}</p>
                <p className="text-xs text-slate-500">Affected: {flag.cells.map(describeCell).join(', ')}</p>
                <p className="text-xs text-slate-500">Flagged on {FLAGGED_AT.format(new Date(flag.createdAt))}</p>
                <Link to={`/venues/bookings/${flag.bookingId}/replacement`} className="mr-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
                  Find replacement
                </Link>
                <Link
                  to={`/requests/${flag.eventId}`}
                  className="inline-block text-sm font-medium text-indigo-700 hover:underline"
                >
                  Open request
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
