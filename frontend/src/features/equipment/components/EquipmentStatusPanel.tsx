import { useEffect, useRef, useState, type FormEvent } from 'react'
import { catalogueStatusLabel } from '../catalogueStatus'
import { equipmentStatusTargets, type EquipmentStatusInput } from '../equipmentStatusValidation'
import { loadEquipmentStatus, saveEquipmentStatus, type EquipmentStatusDetails, type EquipmentStatusResult } from '../equipmentStatusService'
import { EquipmentStatusHistory } from './EquipmentStatusHistory'

interface Props {
  itemId: string
  assetTag: string
  onClose: () => void
  onSaved: (result: EquipmentStatusResult) => void
}
export function EquipmentStatusPanel({ itemId, assetTag, onClose, onSaved }: Props) {
  const [details, setDetails] = useState<EquipmentStatusDetails | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<EquipmentStatusInput['status'] | ''>('')
  const [note, setNote] = useState('')
  const active = useRef(false)
  const saving = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    let current = true
    setLoading(true)
    setDetails(null)
    setError(null)
    void loadEquipmentStatus(itemId).then((result) => {
      if (!current) return
      if (result.ok) { setDetails(result.data); setLocked(false) }
      else { setError(result.reason); setLocked(true) }
      setLoading(false)
    })
    return () => { current = false }
  }, [itemId, revision])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving.current || loading || locked || !details) return
    if (!target || !note.trim()) { setError('Choose a status and enter a reason.'); return }
    saving.current = true
    setPending(true)
    setError(null)
    const result = await saveEquipmentStatus({ itemId, status: target, note, version: details.version })
    if (!active.current) return
    saving.current = false
    setPending(false)
    if (result.ok) onSaved(result.data)
    else { setError(result.reason); setLocked(true) }
  }

  const blocked = loading || pending || locked || !details
  const button = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50'
  return <section aria-label={`Manage equipment status: ${assetTag}`} className="rounded-lg border border-indigo-200 bg-slate-50 p-4">
    <h2 className="text-lg font-semibold">Manage status: {assetTag}</h2>
    <p className="mt-1 text-sm text-slate-600">Non-operational units cannot be reserved. Affected upcoming reservations stay recorded and are sent for review. Returning a unit to Operational does not automatically resolve reviews.</p>
    {loading && <p role="status">Loading unit status and history…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {details && <p className="mt-3 font-medium">Current status: {catalogueStatusLabel(details.status)}</p>}
    <form onSubmit={(event) => void submit(event)} noValidate className="mt-4 space-y-3">
      <label className="block text-sm font-medium">New status
        <select value={target} disabled={blocked} onChange={(event) => setTarget(event.target.value as EquipmentStatusInput['status'] | '')}
          className="mt-1 block rounded border border-slate-300 p-2">
          <option value="">Choose a status</option>
          {equipmentStatusTargets.map((status) => <option key={status} value={status}>{catalogueStatusLabel(status)}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Reason for status change
        <textarea value={note} disabled={pending || loading} onChange={(event) => setNote(event.target.value)} rows={3}
          className="mt-1 block w-full rounded border border-slate-300 p-2" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={button} disabled={blocked}>{pending ? 'Saving…' : 'Save status'}</button>
        <button type="button" className={button} disabled={loading || pending} onClick={() => setRevision((value) => value + 1)}>Reload unit</button>
        <button type="button" className={button} disabled={pending} onClick={onClose}>Close status panel</button>
      </div>
    </form>
    {details && <EquipmentStatusHistory history={details.history} />}
  </section>
}
