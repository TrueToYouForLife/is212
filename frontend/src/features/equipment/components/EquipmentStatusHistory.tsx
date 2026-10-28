import { formatDateTime } from '../../events/formatters'
import type { EquipmentStatusDetails } from '../equipmentStatusService'
import { catalogueStatusLabel } from '../catalogueStatus'

export function EquipmentStatusHistory({ history }: { history: EquipmentStatusDetails['history'] }) {
  return <section aria-label="Equipment status history" className="mt-6">
    <h3 className="font-semibold">Status history</h3>
    {history.length === 0 ? <p className="mt-2 text-sm text-slate-600">No status changes recorded.</p>
      : <ol className="mt-2 space-y-3">
        {history.map((entry) => <li key={entry.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium">{catalogueStatusLabel(entry.previousStatus)} → {catalogueStatusLabel(entry.newStatus)}</p>
          <p className="whitespace-pre-wrap break-words">{entry.note}</p>
          <p className="mt-1 text-slate-600">{entry.changedByName || 'Name not recorded'} · {formatDateTime(entry.changedAt)} (Singapore time)</p>
        </li>)}
      </ol>}
  </section>
}
