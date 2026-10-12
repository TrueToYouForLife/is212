import type { TimetableCell } from './bookingTypes'

/** Cell colours for venue calendars. Shared by the single-venue timetable (US10) and the
 *  all-venues calendar (US19), so a state looks the same on both. */
export const TIMETABLE_CELL_STYLES: Record<TimetableCell['state'], string> = {
  free: 'bg-white text-slate-400',
  held: 'bg-amber-100 text-amber-900',
  pending_approval: 'bg-indigo-100 text-indigo-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  maintenance: 'bg-slate-300 text-slate-700',
}
