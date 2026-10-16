import { formatDateTime, orDash } from '../formatters'
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

/** Everything AC-005.1 asked the organiser for, laid out for whoever has to decide on it. */
export function RequestDetails({ request }: { request: EventRequestDetail }) {
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
      <Row label="Room layout" value={orDash(request.layoutPreference)} />
      <Row label="Accessibility" value={orDash(request.accessibilityRequirements)} />
      <Row label="Equipment" value={orDash(request.equipmentRequirements)} />
      <Row label="Registration required" value={request.registrationRequired ? 'Yes' : 'No'} />
      <Row label="Special arrangements" value={orDash(request.specialArrangements)} />
      <Row label="Submitted" value={formatDateTime(request.submittedAt)} />
      {request.reviewNote && <Row label="Review note" value={request.reviewNote} />}
    </dl>
  )
}
