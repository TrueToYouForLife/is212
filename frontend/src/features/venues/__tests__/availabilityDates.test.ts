import { describe, expect, test } from 'vitest'
import { formatDayHeading, shiftDate, todayInSingapore } from '../availabilityDates'

describe('AC-019.1 — staff can view availability across dates', () => {
  test('AC-019.1.9: moving a week at a time crosses month and year ends', () => {
    expect(shiftDate('2026-10-12', 7)).toBe('2026-10-19')
    expect(shiftDate('2026-10-28', 7)).toBe('2026-11-04')
    expect(shiftDate('2026-12-29', 7)).toBe('2027-01-05')
    expect(shiftDate('2026-01-03', -7)).toBe('2025-12-27')
  })

  test('AC-019.1.10: "this week" starts on today in Singapore, which is already tomorrow from 16:00 UTC', () => {
    expect(todayInSingapore(Date.parse('2026-10-11T15:59:00Z'))).toBe('2026-10-11')
    expect(todayInSingapore(Date.parse('2026-10-11T16:00:00Z'))).toBe('2026-10-12')
  })

  test('AC-019.1.11: each day is headed with its weekday and date', () => {
    expect(formatDayHeading('2026-10-12')).toEqual({ weekday: 'Mon', day: '12 Oct' })
    expect(formatDayHeading('2026-11-01')).toEqual({ weekday: 'Sun', day: '1 Nov' })
  })
})
