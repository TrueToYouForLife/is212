import { describe, expect, test } from 'vitest'
import { BLOCK_VALIDATION_MESSAGES, validateVenueBlock } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'

const valid: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-10',
  slots: ['T0900'],
  reason: 'Repairs',
}

describe('AC-012.3 — a reason is required', () => {
  test('AC-012.3.4: a reason of only spaces is refused with a message for the field', () => {
    expect(validateVenueBlock({ ...valid, reason: '   ' })).toStrictEqual({
      ok: false,
      errors: { reason: BLOCK_VALIDATION_MESSAGES.reasonRequired },
    })
  })

  test('AC-012.3.5: a valid block is passed on with its reason trimmed', () => {
    expect(validateVenueBlock({ ...valid, reason: '  Repairs  ' })).toStrictEqual({ ok: true, value: valid })
  })
})

describe('AC-012.2 — one date or a range', () => {
  test('AC-012.2.12: a missing first day is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '' })).toStrictEqual({
      ok: false,
      errors: { startsOn: BLOCK_VALIDATION_MESSAGES.startRequired },
    })
  })

  test('AC-012.2.13: a missing last day is refused', () => {
    expect(validateVenueBlock({ ...valid, endsOn: '' })).toStrictEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.endRequired },
    })
  })

  test('AC-012.2.14: a day that does not exist, such as 30 February, is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2040-02-30', endsOn: '2040-03-01' })).toStrictEqual({
      ok: false,
      errors: { startsOn: BLOCK_VALIDATION_MESSAGES.invalidDate },
    })
  })

  test('AC-012.2.15: a block ending before it starts is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2040-03-11', endsOn: '2040-03-10' })).toStrictEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.endBeforeStart },
    })
  })

  test('AC-012.2.16: a block of exactly 366 days is accepted', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2042-01-01', endsOn: '2043-01-01' }).ok).toBe(true)
  })

  test('AC-012.2.17: a block of 367 days is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2042-01-01', endsOn: '2043-01-02' })).toStrictEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.tooLong },
    })
  })
})

describe('AC-012.2 — one or more slots', () => {
  test('AC-012.2.18: a block with no slots is refused', () => {
    expect(validateVenueBlock({ ...valid, slots: [] })).toStrictEqual({
      ok: false,
      errors: { slots: BLOCK_VALIDATION_MESSAGES.slotsRequired },
    })
  })

  test('AC-012.2.19: repeated and unordered slots are passed on once each, in time order', () => {
    expect(validateVenueBlock({ ...valid, slots: ['T2345', 'T0900', 'T0900'] })).toStrictEqual({
      ok: true,
      value: { ...valid, slots: ['T0900', 'T2345'] },
    })
  })

  test('AC-012.2.20: every problem is reported at once, not just the first', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '', slots: [], reason: '' })).toStrictEqual({
      ok: false,
      errors: {
        startsOn: BLOCK_VALIDATION_MESSAGES.startRequired,
        slots: BLOCK_VALIDATION_MESSAGES.slotsRequired,
        reason: BLOCK_VALIDATION_MESSAGES.reasonRequired,
      },
    })
  })
})

test('AC-047.2.35: legacy and malformed codes are refused even alongside valid quarter-hour cells', () => {
  for (const slot of ['AM', 'PM', 'NIGHT', 'T0010', 'T2400', 'T9999'] as VenueBlockInput['slots']) {
    const result = validateVenueBlock({ ...valid, slots: ['T0000', slot] })
    expect(result).toEqual({ ok: false, errors: { slots: BLOCK_VALIDATION_MESSAGES.invalidSlots } })
  }
  expect(validateVenueBlock({ ...valid, slots: ['T2345', 'T0000', 'T1200', 'T0000'] }))
    .toEqual({ ok: true, value: { ...valid, slots: ['T0000', 'T1200', 'T2345'] } })
})
