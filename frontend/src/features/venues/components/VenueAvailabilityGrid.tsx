import { Link } from 'react-router-dom'
import type { TimetableCell } from '../bookingTypes'
import { timetableCellLabel } from '../venueTimetable'
import type { VenueAvailability } from '../venueAvailability'
import { formatDayHeading } from '../availabilityDates'
import { SLOT_SHORT_LABELS, formatPlainDate } from '../slotFormat'
import { TIMETABLE_CELL_STYLES } from '../timetableStyles'

/** What a cell says on screen. The full wording is in its aria-label and tooltip. */
const SHORT_STATE_LABELS: Record<TimetableCell['state'], string> = {
  free: 'Free',
  held: 'Held',
  pending_approval: 'Requested',
  confirmed: 'Booked',
  maintenance: 'Blocked',
}

/** Setup and turnaround cells are striped, so they are not told apart by colour alone. */
const BUFFER_STRIPES = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.65) 0 4px, transparent 4px 8px)',
}

const LEGEND: { state: TimetableCell['state']; label: string }[] = [
  { state: 'free', label: 'Free' },
  { state: 'held', label: 'Tentatively held' },
  { state: 'pending_approval', label: 'Awaiting Venue Staff' },
  { state: 'confirmed', label: 'Confirmed booking' },
  { state: 'maintenance', label: 'Blocked by Venue Staff' },
]

function cellDescription(venueName: string, cell: TimetableCell): string {
  const parts = [`${venueName}, ${formatPlainDate(cell.date)} ${SLOT_SHORT_LABELS[cell.slot]}: ${timetableCellLabel(cell)}`]
  if (cell.eventReference) parts.push(cell.eventReference)
  if (cell.closureReason) parts.push(cell.closureReason)
  return parts.join(', ')
}

/** The colour key, in the order a slot usually moves through. */
export function AvailabilityLegend() {
  return (
    <ul aria-label="Key" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
      {LEGEND.map((item) => (
        <li key={item.state} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3 w-5 rounded-sm border border-slate-200 ${TIMETABLE_CELL_STYLES[item.state]}`} />
          {item.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-5 rounded-sm border border-slate-200 bg-emerald-100" style={BUFFER_STRIPES} />
        Striped: setup or turnaround around a booking
      </li>
    </ul>
  )
}

/**
 * US19: every venue for one week. Each venue has one row per catalogue slot,
 * with one column per day, so staff can scan down a day for a free venue or along a row
 * for one venue's week. Coordinators can open a venue's own timetable to book it.
 */
export function VenueAvailabilityGrid({
  availability,
  linkVenues = false,
}: {
  availability: VenueAvailability
  linkVenues?: boolean
}) {
  return (
    <div className="max-h-[36rem] overflow-auto" role="region" aria-label="All venues availability timetable" tabIndex={0}>
      <table className="w-full min-w-[48rem] table-fixed border-separate border-spacing-x-1 border-spacing-y-0.5 text-xs">
        <caption className="sr-only">Availability of every venue by date and slot</caption>
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            <th scope="col" className="w-44 pb-2 text-left font-medium text-slate-500">Venue</th>
            <th scope="col" className="w-24 pb-2 text-left font-medium text-slate-500">Slot (SGT)</th>
            {availability.dates.map((date) => {
              const heading = formatDayHeading(date)
              return (
                <th key={date} scope="col" className="pb-2 text-center font-medium text-slate-500">
                  <span className="block text-slate-900">{heading.weekday}</span>
                  <span className="block font-normal">{heading.day}</span>
                </th>
              )
            })}
          </tr>
        </thead>
        {availability.rows.map(({ venue, timetable }) => {
          const slotCount = timetable.days[0]?.length ?? 0
          return (
            <tbody key={venue.id} data-testid={`venue-${venue.id}`}>
              {Array.from({ length: slotCount }, (_, slotIndex) => {
                const slot = timetable.days[0][slotIndex].slot
                return (
                  <tr key={slot}>
                    {slotIndex === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={slotCount}
                        className="border-t border-slate-200 py-2 pr-3 text-left align-top font-normal"
                      >
                        {linkVenues ? (
                          <Link
                            to={`/venues/${venue.id}/timetable`}
                            className="text-sm font-semibold text-indigo-700 hover:underline"
                          >
                            {venue.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-slate-900">{venue.name}</span>
                        )}
                        {venue.location && <span className="block text-slate-500">{venue.location}</span>}
                        {venue.status === 'under_maintenance' && (
                          <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                            Under maintenance
                          </span>
                        )}
                      </th>
                    )}
                    <th
                      scope="row"
                      className={`text-left font-medium text-slate-500 ${slotIndex === 0 ? 'border-t border-slate-200' : ''}`}
                    >
                      {SLOT_SHORT_LABELS[slot]}
                    </th>
                    {timetable.days.map((day) => {
                      const cell = day[slotIndex]
                      const description = cellDescription(venue.name, cell)
                      const detail = cell.role === 'buffer'
                        ? 'setup/turnaround'
                        : cell.closureReason ?? cell.eventReference
                      return (
                        <td
                          key={cell.date}
                          data-testid={`cell-${venue.id}|${cell.date}|${cell.slot}`}
                          aria-label={description}
                          title={description}
                          style={cell.role === 'buffer' ? BUFFER_STRIPES : undefined}
                          className={`rounded px-1.5 py-1.5 text-center ${TIMETABLE_CELL_STYLES[cell.state]}`}
                        >
                          {SHORT_STATE_LABELS[cell.state]}
                          {detail && <span className="block truncate text-[10px]">{detail}</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
