import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import { loadOrganiserEquipmentArrangements } from '../organiserEquipmentArrangementService'
import { useRequestResource } from '../status/useRequestResource'

const statuses = {
  reserved: { label: 'Reserved', colour: 'bg-green-50 text-green-800' },
  partially_reserved: { label: 'Partially reserved', colour: 'bg-amber-50 text-amber-800' },
  unavailable: { label: 'Unavailable', colour: 'bg-red-50 text-red-800' },
  pending_review: { label: 'Pending review', colour: 'bg-slate-100 text-slate-700' },
}

export function OrganiserEquipmentArrangements({ eventId, refreshVersion = 0 }: {
  eventId: string; refreshVersion?: number
}) {
  const read = useCallback(() => loadOrganiserEquipmentArrangements(eventId), [eventId])
  const { value, loading, error, refresh } = useRequestResource(`${eventId}:${refreshVersion}`, read)

  return <Card title="Equipment arrangements" description="Reservation updates for equipment recorded by your coordinator.">
    <button type="button" onClick={refresh} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">
      Refresh equipment arrangements
    </button>
    {loading ? <p role="status" className="text-sm text-slate-500">Loading equipment arrangements…</p>
      : error ? <div role="alert" className="text-sm text-red-700">
        {error} <button type="button" onClick={refresh} className="underline">Try again</button>
      </div>
        : value?.length === 0 ? <p className="text-sm text-slate-500">No equipment arrangements have been recorded yet.</p>
          : <div className="space-y-4">{value?.map(item => (
            <article key={item.requirement_id} aria-label={item.equipment_name} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{item.equipment_name}</h3>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statuses[item.status].colour}`}>
                  {statuses[item.status].label}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.quantity_reserved} of {item.quantity_requested} reserved</p>
              {item.status === 'pending_review' && <p className="mt-1 text-sm text-slate-500">
                Awaiting assessment by Technical Support.
              </p>}
            </article>
          ))}</div>}
  </Card>
}
