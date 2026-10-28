import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { proposeVenueReplacement } from '../venueReplacementService'
import type { AffectedVenueBooking } from '../venueReplacementService'
import type { Venue } from '../types'

export function ReplacementProposalForm({ source, target, onBack, onBusyChange }: {
  source: AffectedVenueBooking; target: Venue; onBack: () => void; onBusyChange?: (busy: boolean) => void
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const [saved, setSaved] = useState(false)
  const pending = useRef(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending.current || locked || saved) return
    if (!note.trim()) { setError('Provide a reason and proposed arrangement.'); return }
    pending.current = true; setBusy(true); onBusyChange?.(true); setError(null)
    const result = await proposeVenueReplacement(source.id, target.id, source.version, note)
    pending.current = false; setBusy(false); onBusyChange?.(false)
    if (result.ok) setSaved(true)
    else { setError(result.reason); setLocked(true) }
  }
  if (saved) return <div className="space-y-3">
    <p role="status">Proposal sent to Venue Staff. The original booking remains in place and needs replacement until approval succeeds.</p>
    <Link className="text-indigo-700 hover:underline" to="/venues/bookings">View bookings and replacement history</Link>
  </div>
  return <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
    <h2 className="font-semibold">Request {target.name} as replacement</h2>
    <p>Venue Staff must approve this request. The alternative is not reserved until approval succeeds.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {locked && <p>Reload the booking and search results before trying again. Your note is kept here for reference.</p>}
    <Field id="replacement-reason" label="Reason and proposed arrangement">
      <TextArea id="replacement-reason" value={note} disabled={busy || locked} onChange={event => setNote(event.target.value)} />
    </Field>
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={busy || locked}>{busy ? 'Sending…' : 'Propose replacement'}</Button>
      {!locked && <Button type="button" disabled={busy} onClick={onBack}>Choose another venue</Button>}
    </div>
  </form>
}
