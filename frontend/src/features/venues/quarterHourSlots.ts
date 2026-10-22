import type { TimeSlot } from './slots'
import type { QuarterHourCode } from './venueOccupiedSlots'

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Same complete daily catalogue as migration 0075, including the former lunch gap. */
export const QUARTER_HOUR_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const start = clock(index * 15)
  const end = clock((index + 1) * 15)
  return { value: `T${start.replace(':', '')}` as QuarterHourCode, label: `${start}–${end}` }
})

export const QUARTER_HOUR_SLOTS: TimeSlot[] = QUARTER_HOUR_OPTIONS.map((option, index) => ({
  code: option.value,
  startsAt: `${clock(index * 15)}:00`,
  endsAt: `${clock((index + 1) * 15)}:00`,
  sortOrder: index + 1,
}))
