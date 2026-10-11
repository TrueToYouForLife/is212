import type { VenueBookingReview } from '../venueBookingReviewService'
import { SlotClaimPreview } from './SlotClaimPreview'
import { formatPlainDate, SLOT_SHORT_LABELS } from '../slotFormat'

export function VenueBookingConflicts({ booking }: { booking: VenueBookingReview }) {
  if (!booking.conflictCheckAvailable || !booking.conflicts || !booking.requestedCells) {
    return <p role="alert">Conflicts cannot be checked without complete bookable event timing. Ask the coordinator to update the request.</p>
  }
  return <section aria-label="Venue conflicts" className="space-y-3">
    <h3 className="font-semibold">Requested event and setup/turnaround slots</h3>
    <SlotClaimPreview cells={booking.requestedCells} />
    {booking.conflicts.length === 0 ? <p>No confirmed-booking or active-block conflicts found.</p> : <>
      <p role="alert">This request has venue conflicts.</p>
      <ul className="list-disc pl-5">
        {booking.conflicts.map((conflict, index) => <li key={`${conflict.date}-${conflict.slot}-${index}`}>
          {formatPlainDate(conflict.date)} {SLOT_SHORT_LABELS[conflict.slot]} ({conflict.kind === 'buffer' ? 'setup/turnaround' : 'event'}):{' '}
          {conflict.source === 'blocked_period' ? 'Blocked period' : 'Confirmed booking'} — {conflict.description}
        </li>)}
      </ul>
    </>}
    <p className="text-xs text-slate-500">Conflicts reflect the last reload and must be checked again when approving.</p>
  </section>
}
