import { describe, expect, test } from 'vitest'
import {
  ACTIVE_HOLD_STATUSES, BOOKABLE_EVENT_STATUSES, HOLD_DURATION_DAYS, canBookForEventStatus, daysUntilExpiry,
  describeConflict, describeConflicts, holdExpiryFrom, isHoldLive,
} from '../holdRules'

/** PURE. The rules a tentative hold obeys, with no Supabase anywhere near them. */

const NOW = new Date('2026-10-05T04:00:00.000Z')

describe('AC-009.1 / AC-010.1 — which events may be booked', () => {
  test.each(['approved', 'planning'])('AC-009.1.1: %s is bookable', (status) => {
    expect(canBookForEventStatus(status)).toBe(true)
  })
  test.each(['draft', 'submitted', 'under_review', 'confirmed', 'completed', 'cancelled', 'rejected'])(
    'AC-009.1.2: %s is not bookable', (status) => {
      expect(canBookForEventStatus(status)).toBe(false)
    },
  )
  test.each([null, undefined, ''])('AC-009.1.3: a missing status (%s) is not bookable', (status) => {
    expect(canBookForEventStatus(status)).toBe(false)
  })
  test('AC-009.1.4: the bookable list is exactly approved and planning', () => {
    expect([...BOOKABLE_EVENT_STATUSES]).toEqual(['approved', 'planning'])
  })
    // Deliberately excludes 'confirmed': a multi-venue event can have several confirmed
  // bookings at once (US14's HALL+ANNEX fixture), so only held/pending_approval counts
  // as an active hold blocking a second one for the same event.
  test('AC-009.1.5: an active hold is held or pending_approval only, never confirmed', () => {
    expect([...ACTIVE_HOLD_STATUSES]).toEqual(['held', 'pending_approval'])
  })
})

describe('AC-010.6 — a hold expires after a fixed number of days', () => {
  test('AC-010.6.1: the hold window is three days', () => {
    expect(HOLD_DURATION_DAYS).toBe(3)
  })
  test('AC-010.6.2: the expiry is three days after it was placed', () => {
    expect(holdExpiryFrom(NOW)).toBe('2026-10-08T04:00:00.000Z')
  })
  test('AC-010.6.3: the window can be overridden, for tests and for a shorter hold', () => {
    expect(holdExpiryFrom(NOW, 1)).toBe('2026-10-06T04:00:00.000Z')
  })
  test('AC-010.6.4: a hold in the future is live; one in the past is not', () => {
    expect(isHoldLive('2026-10-08T04:00:00.000Z', NOW)).toBe(true)
    expect(isHoldLive('2026-10-04T04:00:00.000Z', NOW)).toBe(false)
  })
  test('AC-010.6.5: a hold expiring at this very instant is no longer live', () => {
    expect(isHoldLive(NOW.toISOString(), NOW)).toBe(false)
  })
  test('AC-010.6.6: a booking with no expiry is not a live hold', () => {
    expect(isHoldLive(null, NOW)).toBe(false)
  })
  test('AC-010.6.7: days remaining round up, so a live hold never reads as zero days', () => {
    expect(daysUntilExpiry('2026-10-08T04:00:00.000Z', NOW)).toBe(3)
    expect(daysUntilExpiry('2026-10-05T05:00:00.000Z', NOW)).toBe(1)
  })
  test('AC-010.6.8: an expired hold reports no days remaining rather than a negative number', () => {
    expect(daysUntilExpiry('2026-10-01T04:00:00.000Z', NOW)).toBe(0)
  })
})

describe('AC-009.7 — the coordinator is told which slot conflicts and why', () => {
  test.each([
    ['AC-009.7.1', 'event', 'already booked'],
    ['AC-009.7.2', 'buffer', 'the setup or turnaround slot of another booking'],
    ['AC-009.7.3', 'maintenance', 'blocked by Venue Staff'],
  ] as const)('%s: a %s clash is explained as “%s”', (_id, kind, why) => {
    const described = describeConflict({ date: '2026-10-12', slot: 'PM', kind })
    expect(described).toContain('12 Oct 2026')
    expect(described).toContain('PM')
    expect(described).toContain(why)
  })
  test('AC-009.7.4: several clashes are listed together', () => {
    expect(describeConflicts([
      { date: '2026-10-11', slot: 'NIGHT', kind: 'buffer' },
      { date: '2026-10-12', slot: 'AM', kind: 'event' },
    ])).toBe(
      '11 Oct 2026 (Night) — the setup or turnaround slot of another booking; '
      + '12 Oct 2026 (AM) — already booked',
    )
  })
  test('AC-009.7.5: no clashes produces no text to append', () => {
    expect(describeConflicts([])).toBe('')
  })
  test('AC-009.7.12: many clashing slots are summarised per day instead of listed one by one', () => {
    const slots = (date: string, n: number) => Array.from({ length: n }, () => ({ date, slot: 'AM' as const, kind: 'event' as const }))
    const described = describeConflicts([
      ...slots('2026-11-20', 96), ...slots('2026-11-21', 96), ...slots('2026-11-22', 96),
      ...slots('2026-11-23', 96), ...slots('2026-11-24', 96), ...slots('2026-11-25', 40),
    ])
    expect(described).toBe(
      '520 slots clash across 6 days: 20 Nov 2026 (96 slots); 21 Nov 2026 (96 slots); 22 Nov 2026 (96 slots); '
      + '23 Nov 2026 (96 slots); 24 Nov 2026 (96 slots); and 1 more day',
    )
    expect(described.length).toBeLessThan(300)
  })
  test('AC-009.7.13: exactly five clashes are still listed individually (boundary)', () => {
    const five = Array.from({ length: 5 }, () => ({ date: '2026-10-12', slot: 'AM' as const, kind: 'event' as const }))
    expect(describeConflicts(five).split('; ')).toHaveLength(5)
  })
})
