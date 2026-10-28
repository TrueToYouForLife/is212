import { useEffect, useState } from 'react'
import { formatDateTime } from '../../events/formatters'
import { catalogueStatusLabel } from '../catalogueStatus'
import { loadEquipmentReturns, type EquipmentReturns, type ReturnAllocation, type ReturnInspectionHistory } from '../equipmentReturnService'
import { returnFindingLabels } from '../equipmentReturnValidation'
import { formatDay } from '../reservationRules'
import { ReturnInspectionForm } from './ReturnInspectionForm'

const tabs = { out: 'Out', pendingChecks: 'Pending checks', history: 'History' } as const

function InspectionHistory({ rows }: { rows: ReturnInspectionHistory[] }) {
  return rows.length === 0 ? <p>No return inspections recorded.</p> : <ol className="space-y-3">
    {rows.map(row => <li key={row.inspectionId} className="rounded border border-slate-200 p-4">
      <h2 className="font-semibold">{row.assetTag} · {row.typeName}</h2>
      <p>{row.eventName || row.eventReference || 'Unnamed event'}{row.eventName && row.eventReference ? ` (${row.eventReference})` : ''}</p>
      <p>Finding: {returnFindingLabels[row.finding]}</p>
      <p>{catalogueStatusLabel(row.previousStatus)} → {catalogueStatusLabel(row.resultingStatus)}</p>
      {row.description && <p className="whitespace-pre-wrap break-words">{row.description}</p>}
      <p className="mt-1 text-sm text-slate-600">{row.inspectedByName || 'Name not recorded'} · {formatDateTime(row.inspectedAt)} (Singapore time)</p>
    </li>)}
  </ol>
}

export function EquipmentReturnsView() {
  const [data, setData] = useState<EquipmentReturns | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState<keyof typeof tabs>('pendingChecks')
  const [selected, setSelected] = useState<ReturnAllocation | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setLoading(true); setData(null); setError(null)
    void loadEquipmentReturns().then(result => {
      if (!current) return
      if (result.ok) setData(result.data)
      else setError(result.reason)
      setLoading(false)
    })
    return () => { current = false }
  }, [revision])
  const button = 'rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50'
  return <div className="space-y-5">
    <p className="text-sm text-slate-600">Out follows scheduled collection and return dates, including transfer time. Pending checks starts the day after the return date. Dates are shown in Singapore time; physical checkout is not recorded here.</p>
    <p className="text-sm text-slate-600">Pending checks alone does not block a future reservation. Non-operational equipment remains unavailable.</p>
    {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
    <button type="button" className={button} disabled={loading || selected !== null} onClick={() => setRevision(value => value + 1)}>Refresh returns</button>
    {loading && <p role="status">Loading equipment returns…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data && <>
      <div role="tablist" aria-label="Equipment return lists" className="flex flex-wrap gap-2">
        {(Object.keys(tabs) as (keyof typeof tabs)[]).map(key => <button key={key} type="button" role="tab"
          id={`returns-tab-${key}`} aria-controls={`returns-panel-${key}`} aria-selected={tab === key}
          disabled={selected !== null} className={`${button} ${tab === key ? 'bg-indigo-100 font-semibold' : ''}`}
          onClick={() => setTab(key)}>{tabs[key]} ({data[key].length})</button>)}
      </div>
      {selected && <ReturnInspectionForm key={selected.allocationId} allocation={selected} onClose={() => setSelected(null)}
        onReload={setData} onSaved={result => {
          setSelected(null)
          setNotice(`${result.resolved ? 'Inspection recorded.' : 'Missing report recorded; this unit remains pending inspection.'}${result.statusChanged
            ? ` Status: ${catalogueStatusLabel(result.status)}. ${result.reviewCount} ${result.reviewCount === 1 ? 'reservation was' : 'reservations were'} flagged for review.` : ' Operational status unchanged.'}`)
          setRevision(value => value + 1)
        }} />}
      <section role="tabpanel" id={`returns-panel-${tab}`} aria-labelledby={`returns-tab-${tab}`} className="space-y-3">
        {tab === 'history' ? <InspectionHistory rows={data.history} />
          : data[tab].length === 0 ? <p>{tab === 'out' ? 'No equipment is scheduled out today.' : 'No equipment is pending inspection.'}</p>
            : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <caption className="sr-only">{tabs[tab]} equipment allocations</caption>
              <thead><tr>{['Event', 'Equipment', 'Asset tag', 'Collection date', 'Return date', 'Operational status', ...(tab === 'pendingChecks' ? ['Inspection'] : [])]
                .map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
              <tbody>{data[tab].map(row => <tr key={row.allocationId} className="border-t">
                <td className="p-3">{row.eventName || row.eventReference || 'Unnamed event'}{row.eventName && row.eventReference && <span className="block text-xs text-slate-600">{row.eventReference}</span>}</td>
                <td className="p-3">{row.typeName}</td><td className="p-3">{row.assetTag}</td>
                <td className="p-3">{formatDay(row.collectionDate)}</td><td className="p-3">{formatDay(row.returnDate)}</td>
                <td className="p-3">{catalogueStatusLabel(row.operationalStatus)}{row.lastFinding === 'missing' && <span className="block font-medium text-amber-800">Missing reported · follow-up needed</span>}</td>
                {tab === 'pendingChecks' && <td className="p-3"><button type="button" className={button} disabled={selected !== null}
                  aria-label={`Record inspection for ${row.assetTag} (${row.eventReference || row.eventName || row.allocationId})`}
                  onClick={() => { setSelected(row); setNotice(null) }}>Record inspection</button></td>}
              </tr>)}</tbody>
            </table></div>}
      </section>
    </>}
  </div>
}
