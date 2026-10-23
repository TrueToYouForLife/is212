import { useEffect, useState } from 'react'
import { loadEquipmentCatalogue, type EquipmentCatalogue } from '../equipmentCatalogueService'
import { catalogueStatusGroup, catalogueStatusLabel, catalogueStatusOptions } from '../catalogueStatus'
import { EquipmentStatusPanel } from './EquipmentStatusPanel'

export function EquipmentCatalogueView({ canManage = false }: { canManage?: boolean }) {
  const [data, setData] = useState<EquipmentCatalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setData(null)
    void loadEquipmentCatalogue().then((result) => {
      if (!active) return
      if (result.ok) setData(result.data)
      else setError(result.reason)
      setLoading(false)
    })
    return () => { active = false }
  }, [revision])

  if (loading) return <p role="status">Loading equipment catalogue…</p>
  if (error) return <div><p role="alert">{error}</p><button type="button" onClick={() => setRevision((v) => v + 1)}>Try again</button></div>
  if (!data) return null
  const types = new Map(data.types.map((item) => [item.id, item]))
  const locations = [...new Map(data.units.map((unit) => [unit.locationId, unit])).values()]
    .sort((a, b) => a.locationName.localeCompare(b.locationName))
  const units = data.units.filter((unit) => (!type || unit.typeId === type)
    && (!location || unit.locationId === location) && (!status || catalogueStatusGroup(unit.status) === status))
  const selectClass = 'mt-1 block rounded border border-slate-300 p-2'
  return <div className="space-y-6">
    {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
    {canManage && selected && <EquipmentStatusPanel key={selected} itemId={selected}
      assetTag={data.units.find((unit) => unit.id === selected)?.assetTag ?? 'Selected unit'}
      onClose={() => setSelected(null)} onSaved={(result) => {
        setNotice(result.changed
          ? `Status updated. ${result.reviewCount} ${result.reviewCount === 1 ? 'reservation was' : 'reservations were'} flagged for review.`
          : 'Status unchanged. No new history or notifications were created.')
        setSelected(null)
        setRevision((value) => value + 1)
      }} />}
    <section aria-label="Equipment stock totals">
      <h2 className="text-lg font-semibold">Stock by type</h2>
      <p className="text-sm text-slate-600">Totals cover all locations and statuses, regardless of filters. Usable means Operational; availability for an event also depends on reservations and transfer time.</p>
      {data.types.length === 0 ? <p>No equipment types in the catalogue.</p> : <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {data.types.map((item) => <li key={item.id} className="rounded border p-3">
          <h3 className="font-semibold">{item.name}</h3>
          <p>{item.usableUnits} usable / {item.totalUnits} total units</p>
        </li>)}
      </ul>}
    </section>
    <div className="flex flex-wrap items-end gap-4">
      <label>Equipment type<select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All types</option>{data.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Location<select className={selectClass} value={location} onChange={(e) => setLocation(e.target.value)}>
        <option value="">All locations</option>{locations.map((item) => <option key={item.locationId} value={item.locationId}>{item.locationName} — {item.locationDescription}</option>)}
      </select></label>
      <label>Operational status<select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>{catalogueStatusOptions.map((item) => <option key={item}>{item}</option>)}
      </select></label>
      <button type="button" onClick={() => { setType(''); setLocation(''); setStatus('') }}>Reset filters</button>
      <button type="button" disabled={selected !== null} onClick={() => setRevision((v) => v + 1)}>Refresh catalogue</button>
    </div>
    <p role="status">{units.length} equipment {units.length === 1 ? 'unit' : 'units'} shown</p>
    {units.length === 0 ? <p>{data.units.length === 0 ? 'No equipment units in the catalogue.' : 'No equipment units match these filters.'}</p>
      : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Equipment units</caption>
        <thead><tr>{['Asset tag', 'Type', 'Description', 'Location', 'Operational status', ...(canManage ? ['Status management'] : [])].map((title) => <th key={title} scope="col" className="p-3">{title}</th>)}</tr></thead>
        <tbody>{units.map((unit) => <tr key={unit.id} className="border-t">
          <td className="p-3">{unit.assetTag}</td><td className="p-3">{types.get(unit.typeId)?.name}</td>
          <td className="p-3">{types.get(unit.typeId)?.description?.trim() || 'No description recorded'}</td>
          <td className="p-3">{unit.locationName} — {unit.locationDescription}</td>
          <td className="p-3">{catalogueStatusLabel(unit.status)}</td>
          {canManage && <td className="p-3"><button type="button" disabled={selected !== null}
            className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
            onClick={() => { setSelected(unit.id); setNotice(null) }} aria-label={`Manage status for ${unit.assetTag}`}>Manage status</button></td>}
        </tr>)}</tbody>
      </table></div>}
  </div>
}
