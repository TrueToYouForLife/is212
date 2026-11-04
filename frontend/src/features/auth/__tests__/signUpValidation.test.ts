import { describe, expect, test } from 'vitest'
import { CREDENTIAL_MESSAGES, SIGN_UP_MESSAGES, validateSignUp } from '../validation'
import type { SignUpIssue, SignUpValidation } from '../validation'

const valid = { fullName: 'Ada Tan', email: 'ada@example.test', password: 'secret1' }

test('AC-029.1.20: missing sign-up fields report all required fields without throwing', () => {
  expect(issuesOf(validateSignUp({})).map(issue => issue.field).sort()).toEqual(['email', 'fullName', 'password'])
})

function issuesOf(result: SignUpValidation): SignUpIssue[] {
  if (result.ok) throw new Error('expected the input to be rejected')
  return result.issues
}

const messageFor = (result: SignUpValidation, field: SignUpIssue['field']) =>
  issuesOf(result).find((issue) => issue.field === field)?.message

describe('AC-029.1: sign up with a name, email and password', () => {
  test('AC-029.1.4: accepts a valid name, email and password, trimming the name and email', () => {
    const result = validateSignUp({
      fullName: '  Ada Tan ',
      email: ' ada@example.test ',
      password: 'secret1',
    })

    expect(result).toEqual({
      ok: true,
      fullName: 'Ada Tan',
      email: 'ada@example.test',
      password: 'secret1',
    })
  })

  test('AC-029.1.5: rejects a missing name', () => {
    const result = validateSignUp({ ...valid, fullName: '' })
    expect(messageFor(result, 'fullName')).toBe(SIGN_UP_MESSAGES.nameRequired)
  })

  test('AC-029.1.6: rejects a name of only spaces (boundary)', () => {
    const result = validateSignUp({ ...valid, fullName: '   ' })
    expect(messageFor(result, 'fullName')).toBe(SIGN_UP_MESSAGES.nameRequired)
  })

  test('AC-029.1.7: rejects a missing email', () => {
    const result = validateSignUp({ ...valid, email: '' })
    expect(messageFor(result, 'email')).toBe(CREDENTIAL_MESSAGES.emailRequired)
  })

  test('AC-029.1.8: rejects an email without an @', () => {
    const result = validateSignUp({ ...valid, email: 'ada.example.test' })
    expect(messageFor(result, 'email')).toBe(CREDENTIAL_MESSAGES.emailInvalid)
  })

  test('AC-029.1.9: rejects a missing password', () => {
    const result = validateSignUp({ ...valid, password: '' })
    expect(messageFor(result, 'password')).toBe(CREDENTIAL_MESSAGES.passwordRequired)
  })

  test('AC-029.1.10: rejects a 5 character password (boundary, invalid)', () => {
    const result = validateSignUp({ ...valid, password: 'abcde' })
    expect(messageFor(result, 'password')).toBe(CREDENTIAL_MESSAGES.passwordTooShort)
  })

  test('AC-029.1.11: accepts a 6 character password (boundary, valid)', () => {
    expect(validateSignUp({ ...valid, password: 'abcdef' }).ok).toBe(true)
  })

  test('AC-029.1.12: reports every field at once, one message each', () => {
    const issues = issuesOf(validateSignUp({ fullName: '', email: '', password: '' }))
    expect(issues.map((issue) => issue.field).sort()).toEqual(['email', 'fullName', 'password'])
  })
})
