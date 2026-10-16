import { expect, test } from 'vitest'
import { validateChangeRequestReply, CHANGE_REPLY_MESSAGES as messages } from '../changeRequestReplyValidation'
import type { EventChangeRequest } from '../types'

const request: Pick<EventChangeRequest, 'status' | 'proposedChanges' | 'fieldDecisions' | 'reviewNote'> = {
  status: 'clarification_requested', reviewNote: null,
  proposedChanges: { name: 'New title', expectedAttendance: '80', programme: 'Welcome' },
  fieldDecisions: [
    { field: 'name', decision: 'clarification_requested', note: 'Is this the published title?' },
    { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Does this include staff?' },
    { field: 'programme', decision: 'approved', note: '' },
  ],
}
const nameReply = { field: 'name', message: 'Yes, this is the published title.' }
const attendanceReply = { field: 'expectedAttendance', message: 'Yes, including ten staff.' }
const input = { replies: [nameReply, attendanceReply] }

test('AC-007.7.37: accepts separate answers, trims whitespace and returns them in question order', () => {
  expect(validateChangeRequestReply(request, { replies: [attendanceReply, { ...nameReply, message: '  Confirmed.  ' }] }))
    .toEqual({ ok: true, reply: { replies: [{ ...nameReply, message: 'Confirmed.' }, attendanceReply] } })
})
test('AC-007.7.38: refuses submission when an outstanding question has no answer', () => {
  expect(validateChangeRequestReply(request, { replies: [nameReply] }))
    .toEqual({ ok: false, reason: messages.incomplete })
})
test('AC-007.7.39: duplicate answers cannot substitute for another question', () => {
  expect(validateChangeRequestReply(request, { replies: [nameReply, nameReply] }))
    .toEqual({ ok: false, reason: messages.incomplete })
})
test('AC-007.7.40: refuses answers for fields that were not marked for clarification', () => {
  expect(validateChangeRequestReply(request, { replies: [nameReply, { field: 'programme', message: 'Agreed.' }] }))
    .toEqual({ ok: false, reason: messages.incomplete })
})
test('AC-007.7.41: whitespace-only answers cannot be submitted', () => {
  expect(validateChangeRequestReply(request, { replies: [nameReply, { ...attendanceReply, message: ' \n ' }] }))
    .toEqual({ ok: false, reason: messages.empty })
})
test('AC-007.7.42: reply input cannot smuggle in new proposed event values', () => {
  expect(validateChangeRequestReply(request, { ...input, proposedChanges: { expectedAttendance: '500' } }))
    .toEqual({ ok: false, reason: messages.invalidReply })
})
test('AC-007.7.43: a request already returned for review cannot accept another reply', () => {
  expect(validateChangeRequestReply({ ...request, status: 'submitted' }, input))
    .toEqual({ ok: false, reason: messages.unavailable })
})
test('AC-007.7.44: inconsistent stored field decisions cannot create an answerable request', () => {
  expect(validateChangeRequestReply({ ...request, fieldDecisions: [request.fieldDecisions[0]] }, input))
    .toEqual({ ok: false, reason: messages.invalidQuestions })
})
test('AC-007.7.45: supports a text answer to a legacy whole-request clarification', () => {
  expect(validateChangeRequestReply({ ...request, fieldDecisions: [], reviewNote: 'Explain the proposal.' }, { note: '  More guests.  ' }))
    .toEqual({ ok: true, reply: { note: 'More guests.' } })
})
test('AC-007.7.46: a legacy whole-request question still requires a nonblank answer', () => {
  expect(validateChangeRequestReply({ ...request, fieldDecisions: [], reviewNote: 'Explain the proposal.' }, { note: ' ' }))
    .toEqual({ ok: false, reason: messages.empty })
})
test('AC-007.7.47: preparing replies leaves the proposal, questions, provisional decisions and input unchanged', () => {
  const before = structuredClone({ request, input })
  expect(validateChangeRequestReply(request, input).ok).toBe(true)
  expect({ request, input }).toEqual(before)
})
