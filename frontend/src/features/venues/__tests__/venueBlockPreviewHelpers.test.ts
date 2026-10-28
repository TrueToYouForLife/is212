import { describe, expect, test } from 'vitest'
import { groupAffectedBookings, sameBlock } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'

const base: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-12',
  slots: ['T0900', 'T2345'],
  reason: 'Repairs',
}

describe('AC-012.7 — overlaps are previewed before saving', () => {
  test('AC-012.7.6: a preview still applies when only the reason or the slot order changes', () => {
    expect(sameBlock(base, { ...base, reason: 'Something else', slots: ['T2345', 'T0900'] })).toBe(true)
  })

  test('AC-012.7.7: changing the venue, dates or slots makes the preview out of date', () => {
    expect(sameBlock(base, { ...base, venueId: 'v2' })).toBe(false)
    expect(sameBlock(base, { ...base, startsOn: '2040-03-09' })).toBe(false)
    expect(sameBlock(base, { ...base, endsOn: '2040-03-13' })).toBe(false)
    expect(sameBlock(base, { ...base, slots: ['T0900'] })).toBe(false)
  })

  test('AC-012.7.8: preview rows are grouped by booking, keeping each booking\u2019s cells in order', () => {
    const rows = [
      { bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cell: { date: '2040-03-10', slot: 'T0900' as const, kind: 'event' as const } },
      { bookingId: 'b2', status: 'held', eventReference: null, eventName: null,
        cell: { date: '2040-03-10', slot: 'T2345' as const, kind: 'event' as const } },
      { bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cell: { date: '2040-03-10', slot: 'T1300' as const, kind: 'buffer' as const } },
    ]

    expect(groupAffectedBookings(rows)).toStrictEqual([
      {
        bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
        cells: [
          { date: '2040-03-10', slot: 'T0900', kind: 'event' },
          { date: '2040-03-10', slot: 'T1300', kind: 'buffer' },
        ],
      },
      {
        bookingId: 'b2', status: 'held', eventReference: null, eventName: null,
        cells: [{ date: '2040-03-10', slot: 'T2345', kind: 'event' }],
      },
    ])
  })
})
