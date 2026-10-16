import { describe, expect, test } from 'vitest'
import { validateEventDraft } from '../draftValidation'
import { validateEventRequest, VALIDATION_MESSAGES } from '../validation'

describe('AC-001.2', () => {
  test("AC-001.2.1: accepts an empty draft and normalises missing fields", () => {
    expect(validateEventDraft({})).toEqual({ ok: true, value: {
      name: null, purpose: null, eventType: null, description: null,
      proposedStart: null, proposedEnd: null, expectedAttendance: null,
      programme: null, layoutPreference: null, accessibilityRequirements: null,
      equipmentRequirements: null, registrationRequired: false, specialArrangements: null,
    } })
  })

  test("AC-001.2.2: trims supplied text and treats blank inputs as missing", () => {
    const result = validateEventDraft({ name: '  Team dinner  ', purpose: '  ',
      proposedStart: '', proposedEnd: ' ', expectedAttendance: ' ', registrationRequired: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ name: 'Team dinner', purpose: null,
      proposedStart: null, proposedEnd: null, expectedAttendance: null, registrationRequired: true })
  })

  test.each([
    ['AC-001.2.3', 'proposedStart'],
    ['AC-001.2.4', 'proposedEnd'],
  ] as const)("%s: permits only %s to be filled", (_caseId, field) => {
    const date = '2030-01-01T10:00:00+08:00'
    const result = validateEventDraft({ [field]: date })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[field]).toEqual(new Date(date))
  })

  test.each([
    ['AC-001.2.5', 'proposedStart'],
    ['AC-001.2.6', 'proposedEnd'],
  ] as const)("%s: rejects invalid supplied %s", (_caseId, field) => {
    const result = validateEventDraft({ [field]: 'not a date' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual([{ field, message: field === 'proposedStart'
      ? VALIDATION_MESSAGES.startInvalid : VALIDATION_MESSAGES.endInvalid }])
  })

  test.each([
    ['AC-001.2.7', '2026-01-01T09:00:00Z'],
    ['AC-001.2.8', '2026-01-01T10:00:00Z'],
  ] as const)(
    "%s: rejects supplied end %s at or before start", (_caseId, proposedEnd) => {
      expect(validateEventDraft({ proposedStart: '2026-01-01T10:00:00Z', proposedEnd }))
        .toEqual({ ok: false, issues: [{ field: 'proposedEnd', message: VALIDATION_MESSAGES.endBeforeStart }] })
    },
  )

  test.each([
    ['AC-001.2.9', 0],
    ['AC-001.2.10', -1],
    ['AC-001.2.11', '12.5'],
    ['AC-001.2.12', 'many'],
    ['AC-001.2.13', Infinity],
    ['AC-001.2.14', NaN],
    ['AC-001.2.15', 2147483648],
  ] as const)(
    "%s: rejects attendance %s that cannot be stored", (_caseId, expectedAttendance) => {
      const result = validateEventDraft({ expectedAttendance })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].field).toBe('expectedAttendance')
    },
  )

  test.each([
    ['AC-001.2.16', 1],
    ['AC-001.2.17', ' 120 '],
    ['AC-001.2.18', 2147483647],
  ] as const)("%s: accepts valid attendance %s", (_caseId, expectedAttendance) => {
    const result = validateEventDraft({ expectedAttendance })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.expectedAttendance).toBe(Number(expectedAttendance))
  })

  test("AC-001.2.19: reports multiple invalid fields together", () => {
    const result = validateEventDraft({ proposedStart: 'bad', proposedEnd: 'bad', expectedAttendance: -1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map(({ field }) => field)).toEqual(['proposedStart', 'proposedEnd', 'expectedAttendance'])
  })

  test("AC-001.2.20: saving permits old dates while submission still rejects them (also AC-001.6)", () => {
    const input = { purpose: 'Dinner', expectedAttendance: '1',
      proposedStart: '2020-01-01T10:00:00Z', proposedEnd: '2020-01-01T10:00:01Z' }
    expect(validateEventDraft(input).ok).toBe(true)
    expect(validateEventRequest(input, { now: new Date('2026-01-01T00:00:00Z') }).ok).toBe(false)
    expect(validateEventRequest({}).ok).toBe(false)
  })
})
