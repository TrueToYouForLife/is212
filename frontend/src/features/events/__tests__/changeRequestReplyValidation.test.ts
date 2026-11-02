import { describe, expect, test } from 'vitest'
import { CHANGE_REPLY_MESSAGES as messages, validateChangeRequestReply } from '../changeRequestReplyValidation'
import type { EventChangeRequest } from '../types'

type ReplyRequest = Pick<EventChangeRequest, 'status' | 'proposedChanges' | 'fieldDecisions' | 'reviewNote'>
const request: ReplyRequest = {
  status: 'clarification_requested',
  proposedChanges: { name: 'New title', expectedAttendance: '120', purpose: 'Community event', description: 'New description' },
  fieldDecisions: [
    { field: 'name', decision: 'clarification_requested', note: 'Which title?' },
    { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Includes staff?' },
    { field: 'purpose', decision: 'approved', note: '' },
    { field: 'description', decision: 'rejected', note: 'Keep the published description.' },
  ],
  reviewNote: null,
}
const replies = [
  { field: 'expectedAttendance', message: '  Includes ten staff.\n' },
  { field: 'name', message: '\tUse the proposed title.  ' },
]
const legacy: ReplyRequest = { ...request, fieldDecisions: [], reviewNote: 'Please explain the changes.' }
function refuses(candidate: ReplyRequest, input: unknown, reason: string) {
  expect(validateChangeRequestReply(candidate, input)).toEqual({ ok: false, reason })
}

describe('AC-007.7: organiser answers saved questions without editing the proposal', () => {
  test('AC-007.7.37: trims answers into question order and excludes provisional decisions', () => {
    expect(validateChangeRequestReply(request, { replies })).toEqual({ ok: true, reply: { replies: [
      { field: 'name', message: 'Use the proposed title.' },
      { field: 'expectedAttendance', message: 'Includes ten staff.' },
    ] } })
    const single: ReplyRequest = { ...request, proposedChanges: { name: 'New title' }, fieldDecisions: [request.fieldDecisions[0]] }
    expect(validateChangeRequestReply(single, { replies: [replies[1]] })).toEqual({
      ok: true, reply: { replies: [{ field: 'name', message: 'Use the proposed title.' }] },
    })
  })
  test('AC-007.7.38: refuses zero answers and a missing answer', () => {
    for (const answers of [[], [replies[0]]]) refuses(request, { replies: answers }, messages.incomplete)
  })
  test('AC-007.7.39: duplicate answers cannot replace a missing answer or add a third answer', () => {
    for (const answers of [[replies[0], replies[0]], [...replies, replies[0]]]) {
      refuses(request, { replies: answers }, messages.incomplete)
    }
  })
  test('AC-007.7.40: refuses answers for approved, rejected, unproposed or unknown fields', () => {
    for (const field of ['purpose', 'description', 'programme', 'status']) {
      refuses(request, { replies: [replies[0], { field, message: 'An answer.' }] }, messages.incomplete)
    }
  })
  test('AC-007.7.41: refuses empty and whitespace-only answers alongside a valid answer', () => {
    for (const message of ['', ' \t\n ']) {
      refuses(request, { replies: [replies[0], { field: 'name', message }] }, messages.empty)
    }
  })
  test('AC-007.7.42: refuses injected values, decisions, non-text answers and mixed reply formats', () => {
    for (const input of [
      { replies, proposedChanges: { name: 'Injected title' } },
      { replies, decisions: [{ field: 'name', decision: 'approved' }] },
      { replies: [replies[0], { ...replies[1], value: 'Injected title' }] },
      { replies: [replies[0], { ...replies[1], decision: 'approved' }] },
      { replies: [replies[0], { field: 'name', message: 120 }] },
      { replies: [replies[0], { field: 'name', message: null }] },
      { replies: [replies[0], { field: 'name' }] }, { replies, note: 'Mixed format' }, null,
    ]) refuses(request, input, messages.invalidReply)
    for (const input of [{ note: 'Answer', proposedChanges: { name: 'Injected' } }, { note: 'Answer', replies }, { note: 120 }]) {
      refuses(legacy, input, messages.invalidReply)
    }
  })
  test('AC-007.7.43: refuses another reply after submission and other non-clarification statuses', () => {
    for (const status of ['submitted', 'approved', 'partially_approved', 'rejected', 'withdrawn'] as const) {
      refuses({ ...request, status }, { replies }, messages.unavailable)
      refuses({ ...legacy, status }, { note: 'Answer' }, messages.unavailable)
    }
  })
  test('AC-007.7.44: refuses incomplete, duplicate, unrequested or questionless saved reviews', () => {
    const invalid: ReplyRequest[] = [
      { ...request, fieldDecisions: request.fieldDecisions.slice(1) },
      { ...request, fieldDecisions: [request.fieldDecisions[0], request.fieldDecisions[0], ...request.fieldDecisions.slice(2)] },
      { ...request, fieldDecisions: [...request.fieldDecisions.slice(0, 3), { field: 'programme', decision: 'clarification_requested', note: 'Why?' }] },
      { ...request, fieldDecisions: request.fieldDecisions.map((item) => item.decision === 'clarification_requested' ? { ...item, note: ' \t ' } : item) },
      { ...request, fieldDecisions: request.fieldDecisions.map((item) => ({ ...item, decision: 'approved' })) },
      { ...request, proposedChanges: {} }, { ...legacy, reviewNote: null }, { ...legacy, reviewNote: ' \n ' },
    ]
    for (const candidate of invalid) refuses(candidate, { replies }, messages.invalidQuestions)
  })
  test('AC-007.7.45: accepts a trimmed legacy whole-request answer', () => {
    expect(validateChangeRequestReply(legacy, { note: ' \tExplanation of the changes.\n ' }))
      .toEqual({ ok: true, reply: { note: 'Explanation of the changes.' } })
  })
  test('AC-007.7.46: refuses empty and whitespace-only legacy answers', () => {
    for (const note of ['', ' \n\t ']) refuses(legacy, { note }, messages.empty)
  })
  test('AC-007.7.47: preserves proposals, questions, decisions and input on success and refusal', () => {
    const candidate = structuredClone(request)
    const input = { replies: structuredClone(replies) }
    const before = structuredClone({ candidate, input })
    Object.freeze(candidate.proposedChanges)
    candidate.fieldDecisions.forEach(Object.freeze)
    Object.freeze(candidate.fieldDecisions)
    Object.freeze(candidate)
    input.replies.forEach(Object.freeze)
    Object.freeze(input.replies)
    Object.freeze(input)
    expect(validateChangeRequestReply(candidate, input).ok).toBe(true)
    refuses(candidate, { replies: input.replies.slice(0, 1) }, messages.incomplete)
    expect({ candidate, input }).toEqual(before)
    const oldRequest = Object.freeze({ ...legacy })
    const oldInput = Object.freeze({ note: '  Explanation.  ' })
    expect(validateChangeRequestReply(oldRequest, oldInput)).toEqual({ ok: true, reply: { note: 'Explanation.' } })
    expect(oldRequest).toEqual(legacy)
    expect(oldInput.note).toBe('  Explanation.  ')
  })
})
