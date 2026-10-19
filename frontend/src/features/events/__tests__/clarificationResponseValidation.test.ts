import { describe, expect, test } from 'vitest'
import {
  CLARIFICATION_FIELD_COLUMNS,
  CLARIFICATION_MESSAGES,
  changedClarificationFields,
  isAwaitingClarification,
  validateClarificationResponse,
} from '../clarificationResponseValidation'
import { VALIDATION_MESSAGES } from '../validation'
import type { EventRequestDetail } from '../types'

/**
 * US37 — the pure half of AC-037.1 and AC-037.4 (SCRUM-234).
 *
 * 0096 is the control, and clarification_response.sql tests it against real RLS. These
 * check the mirror: that the screen refuses what the database would refuse, and that the
 * whitelist here is still the whitelist there.
 */

const returned: EventRequestDetail = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2046-009', organiserId: 'owner', coordinatorId: 'coord',
  name: 'Annual Showcase', purpose: 'Show this year’s work', eventType: 'Showcase',
  proposedStart: '2046-11-01T02:00:00Z', proposedEnd: '2046-11-01T10:00:00Z',
  expectedAttendance: 80, status: 'submitted', submittedAt: '2046-10-01T02:00:00Z',
  description: null, programme: null, layoutPreference: 'theatre',
  accessibilityRequirements: ['hearing_loop'], facilityRequirements: ['projector'],
  equipmentRequirements: [], registrationRequired: false, specialArrangements: null,
  reviewNote: 'Please confirm the attendance and the layout.',
  reviewedAt: '2046-10-01T01:00:00Z', createdAt: '2046-09-01T02:00:00Z',
  updatedAt: '2046-10-01T01:00:00Z',
}

describe('AC-037.4 — only a returned request may be answered', () => {
  test('AC-037.4.9: a submitted request carrying a question is awaiting clarification', () => {
    expect(isAwaitingClarification(returned)).toBe(true)
  })

  test('AC-037.4.10: a submitted request with no question is not', () => {
    // This is the case 0096 refuses: waiting to be picked up is not the same as returned.
    expect(isAwaitingClarification({ ...returned, reviewNote: null })).toBe(false)
    expect(isAwaitingClarification({ ...returned, reviewNote: '   ' })).toBe(false)
  })

  test('AC-037.4.11: no other status is, whatever note it carries', () => {
    for (const status of ['draft', 'under_review', 'approved', 'planning', 'confirmed',
                          'completed', 'cancelled', 'rejected'] as const) {
      expect(isAwaitingClarification({ ...returned, status })).toBe(false)
    }
  })

  test('AC-037.4.12: an answer to a request that is not returned is refused', () => {
    const result = validateClarificationResponse(
      { ...returned, reviewNote: null }, { reply: 'Here you go', values: {} },
    )
    expect(result).toEqual({ ok: false, reason: CLARIFICATION_MESSAGES.notReturned })
  })
})

describe('AC-037.1 — the revision and the reply', () => {
  test('AC-037.1.10: the editable set is exactly the columns 0096 whitelists', () => {
    // Closed assertion, and the pairing this file exists for. The right-hand side is the
    // literal body of clarification_editable_fields(); if one moves, this fails.
    expect(Object.values(CLARIFICATION_FIELD_COLUMNS).sort()).toEqual([
      'accessibility_requirements', 'description', 'equipment_requirements', 'event_type',
      'expected_attendance', 'facility_requirements', 'layout_preference', 'name',
      'programme', 'proposed_end', 'proposed_start', 'purpose', 'registration_required',
      'special_arrangements',
    ])
  })

  test('AC-037.1.11: a revision is keyed on the database column names', () => {
    const result = validateClarificationResponse(returned, {
      reply: 'Attendance is now 140, so banquet suits it better.',
      values: { expectedAttendance: 140, layoutPreference: 'banquet' },
    })
    expect(result).toEqual({
      ok: true,
      reply: 'Attendance is now 140, so banquet suits it better.',
      updates: { expected_attendance: 140, layout_preference: 'banquet' },
    })
  })

  test('AC-037.1.12: a blank reply is refused before anything is sent', () => {
    const result = validateClarificationResponse(returned, {
      reply: '   ', values: { expectedAttendance: 140 },
    })
    expect(result).toEqual({ ok: false, reason: CLARIFICATION_MESSAGES.replyRequired })
  })

  test('AC-037.1.13: a reply on its own revises nothing and is still valid', () => {
    // "Nothing needs to change, and here is why" is a real answer, so an empty update set
    // is not an error. 0096 accepts it too (AC-037.1.3).
    const result = validateClarificationResponse(returned, {
      reply: 'The venue already confirmed the room, so nothing changes.', values: {},
    })
    expect(result).toEqual({
      ok: true,
      reply: 'The venue already confirmed the room, so nothing changes.',
      updates: {},
    })
  })

  test('AC-037.1.14: a field outside the editable set is refused', () => {
    const result = validateClarificationResponse(returned, {
      reply: 'Approving it myself',
      values: { status: 'approved' } as never,
    })
    expect(result).toEqual({ ok: false, reason: CLARIFICATION_MESSAGES.unknownField })
  })

  test('AC-037.1.15: only fields that actually changed are sent', () => {
    // The form renders every revisable field, so without the diff an answer would claim
    // all fourteen were revised and AC-037.5's record would say nothing useful.
    const result = validateClarificationResponse(returned, {
      reply: 'Only the layout changes.',
      values: {
        name: returned.name, purpose: returned.purpose,
        expectedAttendance: returned.expectedAttendance,
        layoutPreference: 'banquet',
      },
    })
    expect(result).toEqual({
      ok: true, reply: 'Only the layout changes.',
      updates: { layout_preference: 'banquet' },
    })
  })

  test('AC-037.1.16: a reordered requirement list is not a change', () => {
    const changed = changedClarificationFields(
      { accessibilityRequirements: ['hearing_loop', 'lift_access'] },
      { accessibilityRequirements: ['lift_access', 'hearing_loop'] },
    )
    expect(changed).toEqual({})
  })

  test('AC-037.1.17: an empty optional field is not a change when it was already empty', () => {
    // A form cannot produce null, so without this every untouched optional text field
    // would be reported as revised.
    const changed = changedClarificationFields(
      { description: null, specialArrangements: null },
      { description: '', specialArrangements: '' },
    )
    expect(changed).toEqual({})
  })

  test('AC-037.1.18: clearing a field that had a value is a change', () => {
    const changed = changedClarificationFields(
      { description: 'Lunch included' }, { description: '' },
    )
    expect(changed).toEqual({ description: '' })
  })
})

describe('AC-037.1 — the revised request still has to be a valid request', () => {
  test('AC-037.1.19: a blank name or purpose is refused', () => {
    expect(validateClarificationResponse(returned, { reply: 'r', values: { name: '  ' } }))
      .toEqual({ ok: false, reason: CLARIFICATION_MESSAGES.nameRequired })
    expect(validateClarificationResponse(returned, { reply: 'r', values: { purpose: '' } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.purposeRequired })
  })

  test('AC-037.1.20: attendance must be a whole number of at least one', () => {
    expect(validateClarificationResponse(returned, { reply: 'r', values: { expectedAttendance: 12.5 } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.attendanceNumeric })
    expect(validateClarificationResponse(returned, { reply: 'r', values: { expectedAttendance: 0 } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.attendancePositive })
    expect(validateClarificationResponse(returned, { reply: 'r', values: { expectedAttendance: null } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.attendanceRequired })
  })

  test('AC-037.1.21: moving the start past an unchanged end is refused', () => {
    // Boundary, and the reason the checks run against the merged request rather than the
    // revision: only one field was touched, but the pair is what has to make sense.
    const result = validateClarificationResponse(returned, {
      reply: 'Starting later.', values: { proposedStart: '2046-11-01T12:00:00Z' },
    })
    expect(result).toEqual({ ok: false, reason: VALIDATION_MESSAGES.endBeforeStart })
  })

  test('AC-037.1.22: a zero-length booking is refused', () => {
    const result = validateClarificationResponse(returned, {
      reply: 'Same moment.', values: { proposedEnd: returned.proposedStart },
    })
    expect(result).toEqual({ ok: false, reason: VALIDATION_MESSAGES.endBeforeStart })
  })

  test('AC-037.1.23: an unparseable date is refused rather than sent', () => {
    expect(validateClarificationResponse(returned, { reply: 'r', values: { proposedStart: 'next Tuesday' } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.startInvalid })
    expect(validateClarificationResponse(returned, { reply: 'r', values: { proposedEnd: null } }))
      .toEqual({ ok: false, reason: VALIDATION_MESSAGES.endInvalid })
  })

  test('AC-037.1.24: a valid new pair of dates passes', () => {
    const result = validateClarificationResponse(returned, {
      reply: 'Moved a day later.',
      values: { proposedStart: '2046-11-02T02:00:00Z', proposedEnd: '2046-11-02T10:00:00Z' },
    })
    expect(result).toEqual({
      ok: true, reply: 'Moved a day later.',
      updates: {
        proposed_start: '2046-11-02T02:00:00Z', proposed_end: '2046-11-02T10:00:00Z',
      },
    })
  })
})
