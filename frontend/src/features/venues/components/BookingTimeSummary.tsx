import type { ClaimCell } from '../slots'
import { SlotClaimPreview } from './SlotClaimPreview'

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const range = (start: number, end: number) => `${dateTime.format(start)} – ${dateTime.format(end)}`

/** Display actual timing separately from the quarter-hour cells reserved for it. */
export function BookingTimeSummary({ start, end, setupMinutes, turnaroundMinutes, cells }: {
  start: string; end: string; setupMinutes: number; turnaroundMinutes: number; cells: ClaimCell[]
}) {
  const eventStart = new Date(start).getTime()
  const eventEnd = new Date(end).getTime()
  const occupiedStart = eventStart - setupMinutes * 60_000
  const occupiedEnd = eventEnd + turnaroundMinutes * 60_000
  const slotStart = Math.floor(occupiedStart / 900_000) * 900_000
  const slotEnd = Math.ceil(occupiedEnd / 900_000) * 900_000
  const rows = [
    ['Event', range(eventStart, eventEnd)],
    ['Setup', setupMinutes ? `${range(occupiedStart, eventStart)} · ${setupMinutes} minutes` : 'None'],
    ['Turnaround', turnaroundMinutes ? `${range(eventEnd, occupiedEnd)} · ${turnaroundMinutes} minutes` : 'None'],
    ['Total venue occupancy', range(occupiedStart, occupiedEnd)],
    ...(slotStart !== occupiedStart || slotEnd !== occupiedEnd
      ? [['Reserved slot range', range(slotStart, slotEnd)]] : []),
  ]
  return (
    <div className="text-sm text-slate-700">
      <p className="mb-4 text-slate-500">All times are in Singapore time. Setup and turnaround durations are set by Venue Staff.</p>
      <dl className="space-y-3">
        {rows.map(([label, value]) => <div key={label} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium text-slate-900">{label}</dt><dd>{value}</dd>
        </div>)}
      </dl>
      <details className="mt-5">
        <summary className="cursor-pointer font-medium text-indigo-700">View occupied 15-minute slots ({cells.length})</summary>
        <div className="mt-3 max-h-64 overflow-y-auto"><SlotClaimPreview cells={cells} /></div>
      </details>
    </div>
  )
}
