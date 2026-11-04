import { describe, expect, test } from 'vitest'
import { formatDateTime, orDash } from '../formatters'

describe('AC-004.1 — request details are shown safely', () => {
  test('AC-004.1.7: an unparseable date and a blank value both show as a dash rather than "Invalid Date" or nothing', () => {
    expect(formatDateTime('not a date')).toBe('—')
    expect(formatDateTime(null)).toBe('—')
    expect(orDash('   ')).toBe('—')
    expect(orDash(undefined)).toBe('—')
    expect(orDash(0)).toBe('0')
  })
})
