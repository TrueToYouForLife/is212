import { Link } from 'react-router-dom'
import type { AffectedVenueBooking } from '../venueReplacementService'

export function ReplacementBookingNotice({ booking, pending }: { booking: AffectedVenueBooking; pending: boolean }) {
  return <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
    <p className="font-semibold text-amber-900">Needs replacement</p>
    <ul>{booking.reasons.map(reason => <li key={`${reason.store}-${reason.id}`}>{reason.detail}</li>)}</ul>
    {pending ? <p>Replacement request awaiting Venue Staff. The original booking remains in place.</p>
      : <Link className="font-medium text-indigo-700 hover:underline" to={`/venues/bookings/${booking.id}/replacement`}>
        Find replacement
      </Link>}
  </div>
}
