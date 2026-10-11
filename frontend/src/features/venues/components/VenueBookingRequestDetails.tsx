import { formatDateTime, orDash } from '../../events/formatters'
import type { VenueBookingRequestDetails as Details } from '../venueBookingReviewTypes'

export function VenueBookingRequestDetails({ details }: { details: Details }) {
  const rows = [
    ['Event', orDash(details.eventName)], ['Reference', orDash(details.reference)],
    ['Starts (Singapore)', formatDateTime(details.startsAt)], ['Ends (Singapore)', formatDateTime(details.endsAt)],
    ['Expected attendance', orDash(details.attendance)],
    ['Organiser layout preference', orDash(details.layoutPreference)],
    ['Accessibility notes', orDash(details.accessibilityNotes)],
    ['Special arrangements', orDash(details.specialArrangements)],
  ]
  return <section aria-label="Event timing and venue requirements" className="space-y-3">
    <h3 className="font-semibold">Event timing and venue requirements</h3>
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {!details.requirementsRecorded ? <p>Structured venue requirements have not been recorded.</p> : <dl>
      <dt className="text-sm text-slate-500">Required layout</dt><dd>{orDash(details.layout)}</dd>
      <dt className="text-sm text-slate-500">Required accessibility</dt><dd>{details.accessibility.join(', ') || 'None specified'}</dd>
      <dt className="text-sm text-slate-500">Required facilities</dt><dd>{details.facilities.join(', ') || 'None specified'}</dd>
    </dl>}
  </section>
}
