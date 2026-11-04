import { describe, expect, test } from 'vitest'
import { BLOCK_VALIDATION_MESSAGES as messages, validateVenueBlock } from '../venueBlockValidation'

describe('AC-012.2 — a block needs real dates', () => {
  test('AC-012.2.33: a date that does not exist (31 February, or not a date at all) is refused for the first and last day', () => {
    const result = validateVenueBlock({ startsOn: '2026-02-31', endsOn: 'next tuesday', slots: ['full_day'], reason: 'Repairs' } as never)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.startsOn).toBe(messages.invalidDate)
      expect(result.errors.endsOn).toBe(messages.invalidDate)
    }
  })
})
