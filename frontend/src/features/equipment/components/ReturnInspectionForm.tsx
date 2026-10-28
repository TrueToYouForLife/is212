import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { catalogueStatusLabel } from '../catalogueStatus'
import { equipmentStatusTargets } from '../equipmentStatusValidation'
import { returnFindings, returnFindingLabels, returnInspectionInput, type ReturnInspectionInput } from '../equipmentReturnValidation'
import { loadEquipmentReturns, saveReturnInspection, EQUIPMENT_RETURN_MESSAGES, type EquipmentReturns, type ReturnAllocation, type ReturnInspectionResult } from '../equipmentReturnService'

export function ReturnInspectionForm({ allocation, onClose, onSaved, onReload }: {
  allocation: ReturnAllocation; onClose: () => void; onSaved: (result: ReturnInspectionResult) => void
  onReload: (data: EquipmentReturns) => void
}) {
  const [details, setDetails] = useState<ReturnAllocation | null>(allocation)
  const [finding, setFinding] = useState<ReturnInspectionInput['finding'] | ''>('')
  const [target, setTarget] = useState<ReturnInspectionInput['targetStatus']>('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(false)
  const working = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (working.current || locked || !details) return
    if (!finding) { setError('Choose an inspection finding.'); return }
    const input = returnInspectionInput.safeParse({ allocationId: details.allocationId, version: details.version,
      currentStatus: details.operationalStatus, statusVersion: details.statusVersion, finding, targetStatus: target, description })
    if (!input.success) { setError(input.error.issues[0]?.message ?? EQUIPMENT_RETURN_MESSAGES.invalid); return }
    working.current = true
    setPending(true); setError(null)
    const result = await saveReturnInspection(input.data)
    if (!active.current) return
    working.current = false; setPending(false)
    if (result.ok) onSaved(result.data)
    else { setError(result.reason); setLocked(true) }
  }
  async function reload() {
    if (working.current) return
    working.current = true; setReloading(true); setLocked(true); setError(null)
    const result = await loadEquipmentReturns()
    if (!active.current) return
    working.current = false; setReloading(false)
    if (!result.ok) { setDetails(null); setError(result.reason); return }
    onReload(result.data)
    const fresh = result.data.pendingChecks.find(item => item.allocationId === allocation.allocationId)
    setDetails(fresh ?? null)
    if (!fresh) { setError('This allocation is no longer pending inspection. Your findings are kept for reference; close the form to view the updated list.'); return }
    setLocked(false)
  }
  const busy = pending || reloading
  const blocked = busy || locked || !details
  const button = 'rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50'
  const select = 'mt-1 block w-full rounded border border-slate-300 bg-white p-2 disabled:bg-slate-100'
  return <section aria-label={`Inspect equipment: ${allocation.assetTag}`} className="rounded-lg border border-indigo-200 bg-slate-50 p-4">
    <h2 className="text-lg font-semibold">Inspect {allocation.assetTag}</h2>
    <p>{allocation.eventName || allocation.eventReference || 'Unnamed event'} · {allocation.typeName}</p>
    {details && <p className="mt-2 font-medium">Current status: {catalogueStatusLabel(details.operationalStatus)}</p>}
    <p className="mt-2 text-sm text-slate-600">No issues keeps the current status unless you explicitly change it. Missing equipment stays pending and becomes Unavailable. Existing reservations are retained for review when status changes make equipment unusable. Restoring Operational does not resolve existing reviews.</p>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {locked && <p className="mt-2 text-sm">Reload the allocation and review its current details before saving again.</p>}
    {reloading && <p role="status">Reloading allocation…</p>}
    <form onSubmit={event => void submit(event)} noValidate className="mt-4 space-y-4">
      <Field id="return-finding" label="Inspection finding" required>
        <select id="return-finding" className={select} disabled={blocked} value={finding} onChange={event => {
          const next = event.target.value as typeof finding
          setFinding(next); setTarget(next === 'missing' ? 'unavailable' : '')
        }}>
          <option value="">Choose a finding</option>
          {returnFindings.map(value => <option key={value} value={value}>{returnFindingLabels[value]}</option>)}
        </select>
      </Field>
      <Field id="return-description" label="Findings / reason for status change" required={Boolean(finding && finding !== 'good')}>
        <TextArea id="return-description" disabled={busy} value={description} onChange={event => setDescription(event.target.value)} />
      </Field>
      <Field id="return-status" label="Resulting operational status">
        <select id="return-status" className={select} disabled={blocked || finding === 'missing'} value={target}
          onChange={event => setTarget(event.target.value as typeof target)}>
          <option value="">{finding === 'good' && details ? `Keep current status (${catalogueStatusLabel(details.operationalStatus)})` : 'Choose a status'}</option>
          {equipmentStatusTargets.map(value => <option key={value} value={value}>{catalogueStatusLabel(value)}</option>)}
        </select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={blocked} className={button}>{pending ? 'Saving inspection…' : 'Save inspection'}</button>
        <button type="button" disabled={busy} className={button} onClick={() => void reload()}>Reload allocation</button>
        <button type="button" disabled={busy} className={button} onClick={onClose}>Close inspection</button>
      </div>
    </form>
  </section>
}
