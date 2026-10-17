import { formatDateTime, orDash } from '../formatters'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, describeCodes, featureLabel } from '../requirementCatalogue'
import type { FeatureOption } from '../requirementCatalogue'
import type { EventRequestDetail } from '../types'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 sm:col-span-2 sm:mt-0">
        {value}
      </dd>
    </div>
  )
}

interface RequestDetailsProps {
  request: EventRequestDetail
  /** Loaded layout and equipment options, when the caller has them. Without them a code
   *  is shown as itself, which is readable (they are slugs) but less pretty. */
  layouts?: readonly FeatureOption[]
  equipment?: readonly FeatureOption[]
}

/** Everything AC-005.1 asked the organiser for, laid out for whoever has to decide on it. */
export function RequestDetails({ request, layouts = [], equipment = [] }: RequestDetailsProps) {
  return (
    <dl>
      <Row label="Event name" value={orDash(request.name)} />
      <Row label="Purpose" value={orDash(request.purpose)} />
      <Row label="Type of event" value={orDash(request.eventType)} />
      <Row label="Description" value={orDash(request.description)} />
      <Row label="Preferred start" value={formatDateTime(request.proposedStart)} />
      <Row label="Preferred end" value={formatDateTime(request.proposedEnd)} />
      <Row label="Expected attendance" value={orDash(request.expectedAttendance)} />
      <Row label="Programme" value={orDash(request.programme)} />
      <Row
        label="Room layout"
        value={orDash(request.layoutPreference
          ? featureLabel(layouts, request.layoutPreference)
          : null)}
      />
      <Row
        label="Accessibility"
        value={orDash(describeCodes(ACCESSIBILITY_OPTIONS, request.accessibilityRequirements) || null)}
      />
      <Row
        label="Venue facilities"
        value={orDash(describeCodes(FACILITY_OPTIONS, request.facilityRequirements) || null)}
      />
      <Row
        label="Equipment"
        value={orDash(describeCodes(equipment, request.equipmentRequirements) || null)}
      />
      {/* Starts as the organiser asked and then follows the coordinator's setting (US52). */}
      <Row label="Attendee registration" value={request.registrationRequired ? 'Enabled' : 'Disabled'} />
      <Row label="Special arrangements" value={orDash(request.specialArrangements)} />
      <Row label="Submitted" value={formatDateTime(request.submittedAt)} />
      {request.reviewNote && <Row label="Review note" value={request.reviewNote} />}
    </dl>
  )
}
