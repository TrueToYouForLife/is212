import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CLARIFICATION_SERVICE_MESSAGES as messages,
  loadClarificationRounds,
  sendClarificationResponse,
} from '../clarificationResponseService'
import { CLARIFICATION_MESSAGES } from '../clarificationResponseValidation'
import type { EventRequestDetail } from '../types'

/**
 * US37 — the service half of AC-037.1, AC-037.2 and AC-037.5 (SCRUM-234).
 *
 * Mocked: these check what this module sends to 0096 and how it reports the answer back.
 * Whether an Organiser may actually answer is settled in clarification_response.sql against
 * real RLS and the real guards; a mocked test could only prove this file trusts whatever it
 * is handed.
 */

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

const returned: EventRequestDetail = {
  id: EVENT, reference: 'EVT-2046-009', organiserId: 'owner', coordinatorId: 'coord',
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

const answer = { reply: 'Attendance is now 140.', values: { expectedAttendance: 140 } }

/** The ordered select loadClarificationRounds builds, as one chainable stub. */
function stubSelect(result: { data?: unknown; error?: unknown }) {
  const order = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq, order }
}

beforeEach(() => { mocks.rpc.mockReset(); mocks.from.mockReset() })

describe('AC-037.1 — sending the answer', () => {
  test('AC-037.1.25: the revision, the reply and the shown version are all sent', async () => {
    mocks.rpc.mockResolvedValue({ data: 'c0ffee00-0000-4000-8000-0000000000r1', error: null })

    const result = await sendClarificationResponse(returned, answer)

    expect(result).toEqual({ ok: true, responseId: 'c0ffee00-0000-4000-8000-0000000000r1' })
    expect(mocks.rpc).toHaveBeenCalledWith('respond_to_clarification', {
      p_event_id: EVENT,
      p_updates: { expected_attendance: 140 },
      p_reply: 'Attendance is now 140.',
      p_expected_updated_at: '2046-10-01T01:00:00Z',
    })
  })

  test('AC-037.1.26: the version is passed through exactly as shown, never re-read', async () => {
    // The whole point of the check in 0096 is to catch a Coordinator who returned the
    // request again with a different question. Reading updated_at just before writing would
    // defeat precisely the case it exists for, so nothing but the shown value may be sent.
    mocks.rpc.mockResolvedValue({ data: 'r1', error: null })

    await sendClarificationResponse(returned, answer)

    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc.mock.calls[0][1].p_expected_updated_at).toBe(returned.updatedAt)
  })

  test('AC-037.1.27: a request with no version asks for a reload instead of sending', async () => {
    const result = await sendClarificationResponse({ ...returned, updatedAt: null }, answer)

    expect(result).toEqual({ ok: false, reason: messages.reload })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-037.1.28: validation runs before the call, not after it', async () => {
    const result = await sendClarificationResponse(returned, { reply: '  ', values: {} })

    expect(result).toEqual({ ok: false, reason: CLARIFICATION_MESSAGES.replyRequired })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-037.1.29: an id that cannot be a uuid is refused before any call', async () => {
    const result = await sendClarificationResponse({ ...returned, id: 'not-an-id' }, answer)

    expect(result).toEqual({ ok: false, reason: messages.reload })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('AC-037.2 — what each refusal means to the Organiser', () => {
  test('AC-037.2.6: a refused permission says to sign in as the owner', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'nope' } })
    expect(await sendClarificationResponse(returned, answer))
      .toEqual({ ok: false, reason: messages.unavailable })
  })

  test('AC-037.2.7: a stale version or a closed question both say to reload', async () => {
    // 0096 raises 22000 for both, deliberately, and both are answered the same way: look
    // at the request again. Telling them apart would mean parsing the message text.
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'changed' } })
    expect(await sendClarificationResponse(returned, answer))
      .toEqual({ ok: false, reason: messages.reload })
  })

  test('AC-037.2.8: a refused requirement code reports the details, not a failure', async () => {
    // 0054's catalogue trigger and layout foreign key. The reply itself was fine, so
    // "could not be confirmed" would send them looking in the wrong place.
    for (const code of ['23514', '23503']) {
      mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'bad code' } })
      expect(await sendClarificationResponse(returned, answer))
        .toEqual({ ok: false, reason: messages.rejected })
    }
  })

  test('AC-037.2.9: anything unrecognised is an uncertain write, and is not retried', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'gone' } })

    expect(await sendClarificationResponse(returned, answer))
      .toEqual({ ok: false, reason: messages.failed })
    // One attempt only: the request may already be back under review, and a second try
    // would be refused as not-awaiting-clarification, which reads as a bug.
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-037.2.10: a thrown call is an uncertain write too', async () => {
    mocks.rpc.mockRejectedValue(new Error('network'))
    expect(await sendClarificationResponse(returned, answer))
      .toEqual({ ok: false, reason: messages.failed })
  })

  test('AC-037.2.11: a success that returns no id is not reported as success', async () => {
    // Boundary: the RPC returns the response id, so an empty answer means we cannot say
    // the answer was recorded.
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await sendClarificationResponse(returned, answer))
      .toEqual({ ok: false, reason: messages.failed })
  })
})

describe('AC-037.5 — reading the rounds already answered', () => {
  const row = {
    id: 'r1', round: 1, review_note: 'Confirm the attendance.',
    reply: 'It is 140 now.', before_values: { expected_attendance: 80 },
    after_values: { expected_attendance: 140 }, responded_at: '2046-10-02T02:00:00Z',
  }

  test('AC-037.5.11: each round is mapped with its question, reply and both value sets', async () => {
    const { select, eq, order } = stubSelect({ data: [row] })

    const result = await loadClarificationRounds(EVENT)

    expect(result).toEqual({
      ok: true,
      value: [{
        id: 'r1', round: 1, reviewNote: 'Confirm the attendance.', reply: 'It is 140 now.',
        beforeValues: { expected_attendance: 80 }, afterValues: { expected_attendance: 140 },
        respondedAt: '2046-10-02T02:00:00Z',
      }],
    })
    expect(mocks.from).toHaveBeenCalledWith('event_clarification_responses')
    expect(select).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('event_id', EVENT)
    // Newest first: the round being reviewed now is the one the reader wants at the top.
    expect(order).toHaveBeenCalledWith('round', { ascending: false })
  })

  test('AC-037.5.12: a round with no recorded values maps to empty objects, not null', async () => {
    stubSelect({ data: [{ ...row, before_values: null, after_values: null }] })

    const result = await loadClarificationRounds(EVENT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0].beforeValues).toEqual({})
    expect(result.value[0].afterValues).toEqual({})
  })

  test('AC-037.5.13: no rounds yet is an empty success, not a failure', async () => {
    stubSelect({ data: [] })
    expect(await loadClarificationRounds(EVENT)).toEqual({ ok: true, value: [] })
  })

  test('AC-037.5.14: a read error is reported rather than flattened to no history', async () => {
    // An empty list would read as "you have never replied", which is a different and
    // alarming claim to make to someone who has.
    stubSelect({ error: { code: '42501', message: 'nope' } })
    expect(await loadClarificationRounds(EVENT))
      .toEqual({ ok: false, reason: messages.historyFailed })
  })

  test('AC-037.5.15: an id that cannot be a uuid is refused before any query', async () => {
    expect(await loadClarificationRounds('not-an-id'))
      .toEqual({ ok: false, reason: messages.historyFailed })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
