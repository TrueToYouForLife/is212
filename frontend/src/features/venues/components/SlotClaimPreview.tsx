import type { ClaimCell } from '../slots'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'

/**
 * What a booking occupies: its own slots, plus the setup slot before and the turnaround
 * slot after. Shown before a hold is placed, and again on the request afterwards, so the
 * coordinator never has to infer which extra slots were taken.
 */
export function SlotClaimPreview({ cells, compact = false }: { cells: ClaimCell[]; compact?: boolean }) {
  if (cells.length === 0) {
    return <p className="text-sm text-slate-500">These event times fall outside every bookable slot.</p>
  }
  const rows: { cell: ClaimCell; label: string; end: number | null }[] = []
  for (const cell of compact ? [...cells].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot)) : cells) {
    const quarter = /^T([01][0-9]|2[0-3])(00|15|30|45)$/.test(cell.slot)
    const start = quarter ? Number(cell.slot.slice(1, 3)) * 60 + Number(cell.slot.slice(3)) : null
    const last = rows[rows.length - 1]
    const endLabel = start === null ? '' : `${String(Math.floor((start + 15) / 60)).padStart(2, '0')}:${String((start + 15) % 60).padStart(2, '0')}`
    if (compact && start !== null && last && last.end === start && last.cell.date === cell.date && last.cell.kind === cell.kind) {
      last.end = start + 15
      last.label = `${last.label.split('–')[0]}–${endLabel}`
    } else rows.push({ cell, label: SLOT_SHORT_LABELS[cell.slot], end: start === null ? null : start + 15 })
  }
  return (
    <ul className="space-y-1 text-sm">
      {rows.map(({ cell, label }) => (
        <li key={`${cell.date}|${cell.slot}`} className="flex flex-wrap items-center gap-2">
          <span className="text-slate-800">
            {formatPlainDate(cell.date)} ({label})
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              cell.kind === 'event' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {cell.kind === 'event' ? 'Event' : 'Setup / turnaround'}
          </span>
        </li>
      ))}
    </ul>
  )
}
