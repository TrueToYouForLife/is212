import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVenueReplacements } from '../useVenueReplacements'
import type { VenueReplacementsState } from '../useVenueReplacements'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { formatDateTime } from '../../events/formatters'
import { decideVenueReplacement } from '../venueReplacementService'
import type { VenueReplacementRequest, ReplacementDecision } from '../venueReplacementService'

function ReplacementDecisionForm({ request, role, onSaved }: { request: VenueReplacementRequest; role: 'coordinator' | 'venue_staff'; onSaved: () => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const decide = async (decision: ReplacementDecision) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(null)
    const result = await decideVenueReplacement(request.id, request.version, decision, note)
    pending.current = false; setBusy(false)
    if (result.ok) onSaved()
    else setError(result.reason)
  }
  return <fieldset disabled={busy} className="space-y-3">
    {request.sourceChanged && <p role="alert">The original booking or event changed. Withdraw or reject this proposal and submit a fresh one.</p>}
    {error && <p role="alert">{error}</p>}
    <Field id={`replacement-note-${request.id}`} label="Decision note (required)">
      <TextArea id={`replacement-note-${request.id}`} value={note} onChange={e => setNote(e.target.value)} />
    </Field>
    {role === 'venue_staff' ? <div className="flex gap-3">
      <Button type="button" disabled={busy || request.sourceChanged} onClick={() => void decide('approved')}>Approve replacement</Button>
      <Button type="button" onClick={() => void decide('rejected')}>Reject replacement</Button>
    </div> : <Button type="button" onClick={() => void decide('withdrawn')}>Withdraw proposal</Button>}
  </fieldset>
}

export function VenueReplacementPanel({ role, onChanged, state }: {
  role: 'coordinator' | 'venue_staff'; onChanged?: () => void; state?: VenueReplacementsState
}) {
  const local = useVenueReplacements(!state)
  const { data, error, loading, reload } = state ?? local
  const [message, setMessage] = useState<string | null>(null)
  const saved = () => { setMessage('Replacement decision recorded.'); onChanged?.(); void reload() }
  return <Card title="Venue replacements">
    <div className="space-y-4">
      <p>Venue Staff must approve the replacement. Proposals do not reserve the alternative venue; availability is checked again at approval.</p>
      <Button type="button" disabled={loading} onClick={() => { setMessage(null); onChanged?.(); void reload() }}>Reload replacements</Button>
      {loading && <p>Loading replacements…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && <>
        {role === 'coordinator' && (data.sources.length ? <div className="space-y-2">
          <p>Search using the affected event’s requirements to request an alternative.</p>
          <ul>{data.sources.map(source => <li key={source.id}>
            <Link className="text-indigo-700 hover:underline" to={`/venues/bookings/${source.id}/replacement`}>
              Find replacement for {source.eventName} at {source.venueName}
            </Link>
          </li>)}</ul>
        </div> : <p>No affected bookings are eligible for a new proposal.</p>)}
        <h3 id="venue-replacement-history" className="font-semibold">Replacement requests and history</h3>
        {data.requests.length === 0 && <p>No replacement requests.</p>}
        <ul className="space-y-4">{data.requests.map(request => <li key={request.id} className="space-y-3 rounded border p-4">
          <h4 className="font-semibold">{request.eventName}: {request.originalVenue} → {request.targetVenue}</h4>
          <p>Status: {request.status}. Proposed by {request.proposedBy} at {formatDateTime(request.proposedAt)}</p>
          <p>{request.reason}</p>
          <p>{request.details.purpose} — {formatDateTime(request.details.proposedStart)} to {formatDateTime(request.details.proposedEnd)}; attendance {request.details.expectedAttendance}</p>
          <p>Requested layout: {request.details.layoutPreference ?? 'No preference'}. Accessibility: {request.details.accessibilityRequirements.join(', ') || 'None'}. Facilities: {request.details.facilityRequirements.join(', ') || 'None'}.</p>
          <p>Alternative venue: capacity {request.targetCapacity}; layout {request.targetLayout}; accessibility {request.targetAccessibility?.join(', ') || 'None'}; facilities {Object.entries(request.targetFacilities ?? {}).filter(([, value]) => value !== false && value !== null && value !== 0).map(([key]) => key).join(', ') || 'None'}.</p>
          {request.details.specialArrangements && <p>Special arrangements: {request.details.specialArrangements}</p>}
          {request.status === 'pending' ? <ReplacementDecisionForm key={request.version} request={request} role={role} onSaved={saved} />
            : <p>Decision by {request.decidedBy} at {formatDateTime(request.decidedAt)}: {request.decisionNote}</p>}
          {request.replacementBookingId && <p>Replacement booking recorded: {request.replacementBookingId}</p>}
        </li>)}</ul>
      </>}
    </div>
  </Card>
}
