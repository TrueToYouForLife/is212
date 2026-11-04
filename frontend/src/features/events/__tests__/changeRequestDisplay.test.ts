import { expect, test } from 'vitest'
import { formatChangeValue } from '../changeRequestDisplay'

test('AC-007.3.8: readable requirement lists and explicit boolean choices distinguish clearing from missing input', () => {
  expect(formatChangeValue('accessibilityRequirements', ['wheelchair_access', 'hearing_loop']))
    .toBe('Wheelchair access, Hearing loop')
  expect(formatChangeValue('facilityRequirements', ['wifi', 'stage'])).toBe('Wi-Fi, Stage')
  expect(formatChangeValue('equipmentRequirements', ['portable_projector'], {
    equipment: [{ code: 'portable_projector', label: 'Portable projector' }],
  })).toBe('Portable projector')
  expect(formatChangeValue('equipmentRequirements', ['portable_projector'])).toBe('portable_projector')
  for (const field of ['accessibilityRequirements', 'facilityRequirements', 'equipmentRequirements'] as const) {
    expect(formatChangeValue(field, [])).toBe('None')
    expect(formatChangeValue(field, undefined)).toBe('Not provided')
  }
  expect(formatChangeValue('registrationRequired', true)).toBe('Yes')
  expect(formatChangeValue('registrationRequired', false)).toBe('No')
  expect(formatChangeValue('registrationRequired', undefined)).toBe('Not provided')
})

test('AC-007.3.9: layout labels are used when loaded and stored codes remain visible without a match', () => {
  const layouts = [{ code: 'banquet', label: 'Banquet (rounds)' }]
  expect(formatChangeValue('layoutPreference', 'banquet', { layouts })).toBe('Banquet (rounds)')
  expect(formatChangeValue('layoutPreference', 'theatre', { layouts })).toBe('theatre')
  expect(formatChangeValue('layoutPreference', 'banquet')).toBe('banquet')
  expect(formatChangeValue('layoutPreference', null, { layouts })).toBe('Not provided')
})

test('AC-007.3.10: local, UTC and offset dates describe the same Singapore interval across midnight', () => {
  const starts = ['2030-01-01T23:45', '2030-01-01T15:45:00Z', '2030-01-01T10:45:00-05:00']
  const ends = ['2030-01-02T00:15', '2030-01-01T16:15:00Z', '2030-01-01T11:15:00-0500']
  for (const start of starts) expect(formatChangeValue('proposedStart', start)).toBe('1 Jan 2030, 23:45 SGT')
  for (const end of ends) expect(formatChangeValue('proposedEnd', end)).toBe('2 Jan 2030, 00:15 SGT')
})
