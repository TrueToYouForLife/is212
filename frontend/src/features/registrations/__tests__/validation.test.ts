import { describe, expect, test } from 'vitest'
import { REGISTRATION_MESSAGES, canWithdraw, validateRegistration } from '../validation'
import type { RegistrationInput, RegistrationIssue, RegistrationValidation } from '../validation'

const noPrerequisites = { hasPrerequisites: false }
const withPrerequisites = { hasPrerequisites: true }
const valid: RegistrationInput = { phone: '91234567', prerequisitesConfirmed: false }

function messageFor(result: RegistrationValidation, field: RegistrationIssue['field']) {
  if (result.ok) throw new Error('expected the answers to be rejected')
  return result.issues.find((issue) => issue.field === field)?.message
}

describe('AC-015.2: the Attendee inputs the information required to register', () => {
  test('AC-015.2.1: accepts valid answers, trimming text and storing blanks as null', () => {
    const result = validateRegistration(
      { phone: ' +65 9123 4567 ', dietaryRequirements: '  ', accessibilityNeeds: 'Wheelchair' },
      noPrerequisites,
    )

    expect(result).toEqual({
      ok: true,
      answers: {
        phone: '+65 9123 4567',
        dietaryRequirements: null,
        accessibilityNeeds: 'Wheelchair',
        prerequisitesConfirmed: false,
      },
    })
  })

  test('AC-015.2.2: rejects a missing phone number', () => {
    const result = validateRegistration({ ...valid, phone: '' }, noPrerequisites)
    expect(messageFor(result, 'phone')).toBe(REGISTRATION_MESSAGES.phoneRequired)
  })

  test('AC-015.2.3: rejects a phone number with letters', () => {
    const result = validateRegistration({ ...valid, phone: '9123 ABCD' }, noPrerequisites)
    expect(messageFor(result, 'phone')).toBe(REGISTRATION_MESSAGES.phoneInvalid)
  })

  test('AC-015.2.4: rejects 7 digits and accepts 8 (boundary)', () => {
    expect(messageFor(validateRegistration({ ...valid, phone: '9123456' }, noPrerequisites), 'phone'))
      .toBe(REGISTRATION_MESSAGES.phoneInvalid)
    expect(validateRegistration({ ...valid, phone: '91234567' }, noPrerequisites).ok).toBe(true)
  })

  test('AC-015.2.5: accepts 15 digits and rejects 16 (boundary)', () => {
    expect(validateRegistration({ ...valid, phone: '+123456789012345' }, noPrerequisites).ok).toBe(true)
    expect(messageFor(validateRegistration({ ...valid, phone: '+1234567890123456' }, noPrerequisites), 'phone'))
      .toBe(REGISTRATION_MESSAGES.phoneInvalid)
  })

  test('AC-015.2.6: requires the prerequisites confirmation only when the event has prerequisites', () => {
    const unconfirmed = { ...valid, prerequisitesConfirmed: false }

    expect(messageFor(validateRegistration(unconfirmed, withPrerequisites), 'prerequisitesConfirmed'))
      .toBe(REGISTRATION_MESSAGES.prerequisitesRequired)
    expect(validateRegistration(unconfirmed, noPrerequisites).ok).toBe(true)
    expect(validateRegistration({ ...valid, prerequisitesConfirmed: true }, withPrerequisites).ok).toBe(true)
  })
})

describe('AC-023.1: the Attendee can withdraw while the event has not started', () => {
  const now = new Date('2035-03-10T00:00:00Z')
  const active = { registrationStatus: 'registered', eventStatus: 'confirmed', start: '2035-03-10T01:00:00Z' } as const

  test('AC-023.1.6: an active registration for a future Confirmed event can be withdrawn', () => {
    expect(canWithdraw(active, now)).toBe(true)
  })

  test('AC-023.1.7: an event starting exactly now, or already started, cannot (boundary)', () => {
    expect(canWithdraw({ ...active, start: now.toISOString() }, now)).toBe(false)
    expect(canWithdraw({ ...active, start: '2035-03-09T23:59:00Z' }, now)).toBe(false)
  })

  test('AC-023.1.8: a withdrawn registration, or a cancelled or completed event, cannot', () => {
    expect(canWithdraw({ ...active, registrationStatus: 'withdrawn' }, now)).toBe(false)
    expect(canWithdraw({ ...active, eventStatus: 'cancelled' }, now)).toBe(false)
    expect(canWithdraw({ ...active, eventStatus: 'completed' }, now)).toBe(false)
  })
})
