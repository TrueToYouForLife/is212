import type { TimetableCell, VenueTimetable } from '../bookingTypes'
import { timetableCellLabel } from '../venueTimetable'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import { TIMETABLE_CELL_STYLES } from '../timetableStyles'

const sections = [
  { label: 'Morning', start: 0, end: 720 },
  { label: 'Afternoon', start: 720, end: 1080 },
  { label: 'Evening', start: 1080, end: 1440 },
]
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
function bounds(cell: TimetableCell): [number, number] {
  if (cell.slot === 'AM') return [0, 720]
  if (cell.slot === 'PM') return [720, 1080]
  if (cell.slot === 'NIGHT') return [1080, 1440]
  const start = Number(cell.slot.slice(1, 3)) * 60 + Number(cell.slot.slice(3, 5))
  return [start, start + 15]
}

/** Group only adjacent, identical occupancy; never hide gaps or merge different bookings. */
function ranges(day: TimetableCell[], start: number, end: number, selectedKeys: Set<string>) {
  const result: { cell: TimetableCell; start: number; end: number; selected: boolean }[] = []
  for (const cell of [...day].sort((a, b) => bounds(a)[0] - bounds(b)[0])) {
    const [from, to] = bounds(cell)
    if (from < start || from >= end) continue
    const selected = selectedKeys.has(`${cell.date}|${cell.slot}`)
    const previous = result[result.length - 1]
    if (previous && previous.end === from && previous.selected === selected &&
      previous.cell.state === cell.state && previous.cell.role === cell.role &&
      previous.cell.bookingId === cell.bookingId && previous.cell.eventReference === cell.eventReference &&
      previous.cell.closureReason === cell.closureReason) {
      previous.end = to
    } else result.push({ cell, start: from, end: to, selected })
  }
  return result
}

export function VenueTimetableGrid({ timetable, selectedKeys = new Set<string>() }: {
  timetable: VenueTimetable; selectedKeys?: Set<string>
}) {
  const days = timetable.days.filter(day => day.length > 0)
  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">Singapore time. Sections group the display only; bookings still use 15-minute intervals. Green highlights show your selected available periods; red highlights show selected periods already occupied.</p>
      <div className="max-h-[36rem] overflow-auto" role="region" aria-label="Venue availability timetable" tabIndex={0}>
        <table className="w-full min-w-[48rem] border-separate border-spacing-2 text-sm">
          <caption className="sr-only">Venue availability by date and time range</caption>
          <thead className="sticky top-0 z-10 bg-white"><tr>
            <th scope="col" className="text-left text-xs text-slate-500">Time (SGT)</th>
            {days.map(day => <th key={day[0].date} scope="col" className="min-w-40 text-xs font-medium text-slate-500">{formatPlainDate(day[0].date)}</th>)}
          </tr></thead>
          <tbody>{sections.map(section => <tr key={section.label}>
            <th scope="row" className="align-top text-left text-xs font-medium text-slate-500">
              {section.label}<span className="block whitespace-nowrap">{clock(section.start)}–{clock(section.end)}</span>
            </th>
            {days.map(day => <td key={day[0].date} className="align-top">
              <div className="space-y-2">{ranges(day, section.start, section.end, selectedKeys).map(({ cell, start, end, selected }) => {
                const key = `${cell.date}|${cell.slot}`
                const timeLabel = cell.slot.startsWith('T') ? `${clock(start)}–${clock(end)}` : SLOT_SHORT_LABELS[cell.slot]
                return <div key={key} data-testid={`cell-${key}`}
                  aria-label={`${formatPlainDate(cell.date)} ${timeLabel}: ${timetableCellLabel(cell)}${selected ? ', selected for your booking' : ''}`}
                  className={`rounded-md px-2 py-3 text-center text-xs ${selected ? (cell.state === 'free' ? 'bg-emerald-200 text-emerald-950 ring-2 ring-emerald-600 ring-offset-1' : 'bg-red-100 text-red-900 ring-2 ring-red-600 ring-offset-1') : TIMETABLE_CELL_STYLES[cell.state]}`}>
                  <span className="block font-semibold">{timeLabel}</span>
                  {timetableCellLabel(cell)}
                  {cell.eventReference && <span className="block text-[10px]">{cell.eventReference}</span>}
                  {cell.closureReason && <span className="block">{cell.closureReason}</span>}
                  {selected && <span className="block font-medium">{cell.state === 'free' ? 'Selected for your booking' : 'Selected — already occupied'}</span>}
                </div>
              })}</div>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
