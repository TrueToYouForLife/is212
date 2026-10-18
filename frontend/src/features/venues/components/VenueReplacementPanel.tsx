import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { formatDateTime } from '../../events/formatters'
import { getVenueReplacements, proposeVenueReplacement, decideVenueReplacement } from '../venueReplacementService'
import type { VenueReplacementContext, VenueReplacementRequest, ReplacementDecision } from '../venueReplacementService'

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

export function VenueReplacementPanel({ role, onChanged }: { role: 'coordinator' | 'venue_staff'; onChanged?: () => void }) {
  const [data, setData] = useState<VenueReplacementContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [booking, setBooking] = useState('')
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const sequence = useRef(0)
  const pending = useRef(false)
  const load = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true); setError(null); setData(null)
    const result = await getVenueReplacements()
    if (sequence.current !== current) return
    if (result.ok) setData(result.value)
    else setError(result.reason)
    setLoading(false)
  }, [])
  const invalidate = useCallback(() => { sequence.current++ }, [])
  useEffect(() => { void load(); return invalidate }, [load, invalidate])
  const saved = () => { setMessage('Replacement decision recorded.'); onChanged?.(); void load() }
  const propose = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending.current) return
    pending.current = true; setBusy(true); setError(null); setMessage(null)
    const source = data?.sources.find(x => x.id === booking)
    const result = await proposeVenueReplacement(booking, target, source?.version ?? '', reason)
    pending.current = false; setBusy(false)
    if (result.ok) { setBooking(''); setTarget(''); setReason(''); setMessage('Proposal sent to Venue Staff. The original booking remains in place.'); void load() }
    else setError(result.reason)
  }
  return <Card title="Retired venue replacements">
    <div className="space-y-4">
      <p>Venue Staff must approve the replacement. Proposals do not reserve the alternative venue; availability is checked again at approval.</p>
      <Button type="button" disabled={loading || busy} onClick={() => { setMessage(null); void load() }}>Reload replacements</Button>
      {loading && <p>Loading replacements…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && <>
        {role === 'coordinator' && (data.sources.length ? <form onSubmit={propose} className="space-y-3">
          <fieldset disabled={busy} className="space-y-3">
            <Field id="replacement-source" label="Original booking at a retired venue">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" id="replacement-source" value={booking} onChange={e => setBooking(e.target.value)}>
                <option value="">Choose a booking</option>
                {data.sources.map(x => <option key={x.id} value={x.id}>{x.eventName} — {x.venueName}</option>)}
              </select>
            </Field>
            <Field id="replacement-target" label="Alternative venue">
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" id="replacement-target" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">Choose an active venue</option>
                {data.venues.map(x => <option key={x.id} value={x.id}>{x.name} — {x.location} (capacity {x.capacity})</option>)}
              </select>
            </Field>
            <Field id="replacement-reason" label="Reason and proposed arrangement">
              <TextArea id="replacement-reason" value={reason} onChange={e => setReason(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Propose replacement'}</Button>
          </fieldset>
        </form> : <p>No retired-venue bookings are eligible for a new proposal.</p>)}
        <h3 className="font-semibold">Replacement requests and history</h3>
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
