import { expect, test } from 'vitest'
import { occupiedVenueCells } from '../venueOccupiedSlots'

const at = (time: string) => new Date(`2047-10-25T${time}:00+08:00`)
const zero = { setupMinutes: 0, turnaroundMinutes: 0 }

test('AC-047.2.23: frontend matches the database customer example and venue-specific zero buffers', () => {
  const start = at('10:00')
  const end = at('12:00')
  const cells = occupiedVenueCells(start, end, { setupMinutes: 30, turnaroundMinutes: 45 })
  expect(cells.map(c => c.slot)).toEqual([
    'T0930', 'T0945', 'T1000', 'T1015', 'T1030', 'T1045', 'T1100',
    'T1115', 'T1130', 'T1145', 'T1200', 'T1215', 'T1230',
  ])
  expect(cells.map(c => c.kind)).toEqual([
    'buffer', 'buffer', 'event', 'event', 'event', 'event', 'event',
    'event', 'event', 'event', 'buffer', 'buffer', 'buffer',
  ])
  expect(cells.every(c => c.date === '2047-10-25')).toBe(true)
  const plain = occupiedVenueCells(start, end, zero)
  expect(plain).toHaveLength(8)
  expect(plain.every(c => c.kind === 'event')).toBe(true)
  expect(plain.at(-1)?.slot).toBe('T1145')
  expect(start.toISOString()).toBe('2047-10-25T02:00:00.000Z')
  expect(end.toISOString()).toBe('2047-10-25T04:00:00.000Z')
})

test('AC-047.2.24: midnight, lunch, partial cells and adjacent boundaries match the quarter-hour model', () => {
  const midnight = occupiedVenueCells(at('00:00'), at('00:15'), { setupMinutes: 30, turnaroundMinutes: 45 })
  expect(midnight).toEqual([
    { date: '2047-10-24', slot: 'T2330', kind: 'buffer' },
    { date: '2047-10-24', slot: 'T2345', kind: 'buffer' },
    { date: '2047-10-25', slot: 'T0000', kind: 'event' },
    { date: '2047-10-25', slot: 'T0015', kind: 'buffer' },
    { date: '2047-10-25', slot: 'T0030', kind: 'buffer' },
    { date: '2047-10-25', slot: 'T0045', kind: 'buffer' },
  ])
  expect(occupiedVenueCells(at('12:07'), at('12:22'), zero).map(c => c.slot)).toEqual(['T1200', 'T1215'])
  expect(occupiedVenueCells(at('12:00'), at('12:15'), zero)).toEqual([
    { date: '2047-10-25', slot: 'T1200', kind: 'event' },
  ])
  expect(occupiedVenueCells(at('12:15'), at('12:30'), zero)[0].slot).toBe('T1215')
})

test('AC-047.2.25: invalid timing and durations are refused rather than shown as free availability', () => {
  for (const [start, end] of [[new Date('invalid'), at('12:00')], [at('12:00'), at('12:00')], [at('12:00'), at('11:00')]]) {
    expect(() => occupiedVenueCells(start, end, zero)).toThrow('finite event start')
  }
  for (const invalid of [-15, 10, 15.5, NaN, Infinity]) {
    expect(() => occupiedVenueCells(at('10:00'), at('12:00'), { ...zero, setupMinutes: invalid })).toThrow('multiples of 15')
    expect(() => occupiedVenueCells(at('10:00'), at('12:00'), { ...zero, turnaroundMinutes: invalid })).toThrow('multiples of 15')
  }
})
