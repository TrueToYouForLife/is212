import { describe, expect, test } from 'vitest'
import { VALIDATION_MESSAGES, codeListSchema, layoutCodeSchema, validateEventRequest } from '../validation'

describe('AC-002.2 — only known layouts and facilities are accepted', () => {
  test('AC-002.2.20: a layout outside the catalogue is refused; a blank one, or no catalogue yet, is not checked', () => {
    const schema = layoutCodeSchema(['theatre', 'cabaret'])
    const refused = schema.safeParse('banquet')
    expect(refused.success).toBe(false)
    if (!refused.success) expect(refused.error.issues[0].message).toBe(VALIDATION_MESSAGES.layoutUnknown)
    expect(schema.safeParse('  ').success).toBe(true)
    expect(layoutCodeSchema(undefined).safeParse('banquet').success).toBe(true)
  })

  test('AC-002.2.21: a code list with an unknown code is refused with the given message, reported once', () => {
    const refused = codeListSchema(['projector'], 'Unknown equipment').safeParse(['projector', 'laser', 'smoke machine'])
    expect(refused.success).toBe(false)
    if (!refused.success) expect(refused.error.issues.map((issue) => issue.message)).toEqual(['Unknown equipment'])
  })

  test('AC-002.2.22: input that is not a request at all is reported against the whole form', () => {
    const result = validateEventRequest(null as never)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toEqual(['form'])
  })
})
