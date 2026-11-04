import { describe, expect, test } from 'vitest'
import { draftFormValues, toDateTimeInput } from '../draftFormValues'

describe('AC-001.4', () => {
  test("AC-001.4.21: restored dates preserve their instant and precision", () => {
    const timestamp = '2030-06-01T10:30:45.123Z'
    expect(new Date(toDateTimeInput(timestamp)).toISOString()).toBe(timestamp)
  })

  test("AC-001.4.22: missing dates remain empty (also AC-001.2)", () => {
    expect(toDateTimeInput()).toBe('')
    expect(toDateTimeInput('')).toBe('')
  })

  test("AC-001.4.23: attendance is restored as form text", () => {
    const values = draftFormValues({ id: 'draft-1', status: 'draft', updatedAt: '', values: {
      name: 'Dinner', expectedAttendance: 12, registrationRequired: true,
    } })
    expect(values).toMatchObject({ name: 'Dinner', expectedAttendance: '12', purpose: '', registrationRequired: true })
  })

  test("AC-001.4.35: an invalid date string restores as empty without losing other draft fields", () => {
    const values = draftFormValues({ id: 'draft-1', status: 'draft', updatedAt: '', values: {
      name: 'Dinner', purpose: 'Celebrate', expectedAttendance: 12,
      proposedStart: 'not-a-date', proposedEnd: 'not-a-date',
    } })
    expect(values).toMatchObject({
      proposedStart: '', proposedEnd: '', name: 'Dinner', purpose: 'Celebrate', expectedAttendance: '12',
    })
  })

  test("AC-001.4.36: editing restored requirement lists does not mutate the loaded draft", () => {
    const saved = { id: 'draft-1', status: 'draft' as const, updatedAt: '', values: {
      layoutPreference: 'theatre',
      accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'], equipmentRequirements: ['wireless_mic'],
    } }
    const values = draftFormValues(saved)
    expect(values).toMatchObject(saved.values)
    values.accessibilityRequirements.push('hearing_loop')
    values.facilityRequirements.length = 0
    values.equipmentRequirements.push('speaker')
    expect(saved.values).toEqual({
      layoutPreference: 'theatre', accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'], equipmentRequirements: ['wireless_mic'],
    })
  })
})
