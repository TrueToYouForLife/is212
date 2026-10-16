import { formatDateTime, orDash } from '../../events/formatters'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, featureLabel } from '../venueFeatureCatalogue'
import type { FeatureOption } from '../venueFeatureCatalogue'
import type { VenueBookingRequestDetails as Details } from '../venueBookingReviewTypes'

/**
 * Codes to words. An unknown code is shown as itself rather than dropped.
 *
 * The list is defaulted because this data comes from get_venue_booking_review: against a
 * database where 0056 has not been applied yet the new keys are simply absent, and a
 * missing requirement list should read as "none recorded", not crash the review screen.
 */
function describe(
  options: readonly FeatureOption[],
  codes: readonly string[] | null | undefined,
): string {
  return (codes ?? []).map((code) => featureLabel(options, code)).join(', ')
}

export function VenueBookingRequestDetails({ details }: { details: Details }) {
  const rows = [
    ['Event', orDash(details.eventName)], ['Reference', orDash(details.reference)],
    ['Starts (Singapore)', formatDateTime(details.startsAt)], ['Ends (Singapore)', formatDateTime(details.endsAt)],
    ['Expected attendance', orDash(details.attendance)],
    // The organiser's own requirements, as catalogue codes since 0054/0056.
    ['Organiser layout preference', orDash(details.layoutPreference)],
    ['Organiser accessibility requirements',
      orDash(describe(ACCESSIBILITY_OPTIONS, details.accessibilityRequirements) || null)],
    ['Organiser facility requirements',
      orDash(describe(FACILITY_OPTIONS, details.facilityRequirements) || null)],
    ['Special arrangements', orDash(details.specialArrangements)],
  ]
  return <section aria-label="Event timing and venue requirements" className="space-y-3">
    <h3 className="font-semibold">Event timing and venue requirements</h3>
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {!details.requirementsRecorded ? <p>Structured venue requirements have not been recorded.</p> : <dl>
      <dt className="text-sm text-slate-500">Required layout</dt><dd>{orDash(details.layout)}</dd>
      <dt className="text-sm text-slate-500">Required accessibility</dt><dd>{describe(ACCESSIBILITY_OPTIONS, details.accessibility) || 'None specified'}</dd>
      <dt className="text-sm text-slate-500">Required facilities</dt><dd>{describe(FACILITY_OPTIONS, details.facilities) || 'None specified'}</dd>
    </dl>}
  </section>
}
