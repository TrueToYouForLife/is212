/**
 * PURE MODULE — US19. Date helpers for moving the availability calendar a week at a time.
 * Dates are plain 'YYYY-MM-DD' strings in Singapore time, as everywhere else in venues.
 */

const SGT_OFFSET_MS = 8 * 3_600_000   // Singapore has no daylight saving
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** The date `days` after (or, if negative, before) the given one. */
export function shiftDate(date: string, days: number): string {
  const shifted = parse(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

/** Today's date in Singapore, which is already tomorrow from 16:00 UTC. */
export function todayInSingapore(now: number = Date.now()): string {
  return new Date(now + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Column heading for one day: 'Mon' over '12 Oct', short enough for seven columns. */
export function formatDayHeading(date: string): { weekday: string; day: string } {
  const parsed = parse(date)
  return {
    weekday: WEEKDAYS[parsed.getUTCDay()],
    day: `${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]}`,
  }
}
