import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CHANGE_REVIEW_MESSAGES } from '../changeRequestReviewValidation'
import { CHANGE_REVIEW_SERVICE_MESSAGES as messages, saveChangeRequestReview } from '../changeRequestReviewService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from },
}))

const request = { id: 'change-1', proposedChanges: { name: 'New name', expectedAttendance: '80' } }
const version = '2026-09-25T01:00:00.123456+00:00'
const approved = { action: 'decide', decisions: [
  { field: 'name', decision: 'approved', note: '' },
  { field: 'expectedAttendance', decision: 'approved', note: '' },
] }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator-1' } }, error: null })
  mocks.rpc.mockResolvedValue({ data: 'approved', error: null })
})

describe('AC-007.2 — authentication and authoritative assignment checks', () => {
  test.each([
    ['AC-007.2.19', { data: { user: null }, error: null }],
    ['AC-007.2.20', { data: { user: { id: 'coordinator-1' } }, error: { message: 'Expired' } }],
  ])('%s: refuses an absent or expired session', async (_id, session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-007.2.21: reports a server permission denial without exposing internal details', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private details' } })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.unavailable })
  })
})

describe('AC-007.5 — persist complete and partial decisions', () => {
  test('AC-007.5.20: sends one atomic review with the exact displayed version and no client event writes', async () => {
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: true, status: 'approved' })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('review_event_change_request', {
      p_request_id: request.id, p_event_updated_at: version, p_review: approved,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-007.5.21: preserves partial decisions and trims the rejected field explanation', async () => {
    mocks.rpc.mockResolvedValue({ data: 'partially_approved', error: null })
    const decisions = [approved.decisions[0], { field: 'expectedAttendance', decision: 'rejected', note: '  Capacity exceeded  ' }]
    expect(await saveChangeRequestReview(request, version, { action: 'decide', decisions }))
      .toEqual({ ok: true, status: 'partially_approved' })
    expect(mocks.rpc.mock.calls[0][1].p_review.decisions[1].note).toBe('Capacity exceeded')
  })

  test('AC-007.5.22: incomplete decisions never reach the database', async () => {
    expect(await saveChangeRequestReview(request, version, { action: 'decide', decisions: [approved.decisions[0]] }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.incompleteDecisions })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-007.5.23: stale event details require reloading rather than silently retrying', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'Event details changed; reload before reviewing' } })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.reload })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-007.5.24: a request already reviewed or withdrawn requires reloading', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'This request is no longer pending review' } })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.reload })
  })

  test('AC-007.5.25: unknown database errors are not exposed to users', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private details' } })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.failed })
  })

  test('AC-007.5.26: a lost response asks the user to check status and does not automatically resubmit', async () => {
    mocks.rpc.mockRejectedValue(new Error('Offline'))
    await expect(saveChangeRequestReview(request, version, approved)).resolves.toEqual({ ok: false, reason: messages.failed })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-007.5.27: an unexpected success payload is not reported as a completed review', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.failed })
  })
  test('AC-007.5.39: includes the displayed request version when reviewing a reply', async () => {
    await saveChangeRequestReview({ ...request, reviewVersion: 4 }, version, approved)
    expect(mocks.rpc.mock.calls[0][1].p_review).toEqual({ ...approved, requestVersion: 4 })
  })
  test('AC-007.5.40: an outdated request version requires reloading the replies', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'Request changed; reload before reviewing' } })
    expect(await saveChangeRequestReview({ ...request, reviewVersion: 2 }, version, approved))
      .toEqual({ ok: false, reason: messages.reload })
  })
})

describe('AC-007.6 — rejection explanations', () => {
  test('AC-007.6.5: a blank rejection reason prevents saving', async () => {
    const decisions = approved.decisions.map((decision) => ({ ...decision, decision: 'rejected', note: '  ' }))
    expect(await saveChangeRequestReview(request, version, { action: 'decide', decisions }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.rejectionNoteRequired })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('AC-007.7 — clarification instead of a decision', () => {
  test('AC-007.7.7: sends only a clarification message, with no approved values or decisions', async () => {
    mocks.rpc.mockResolvedValue({ data: 'clarification_requested', error: null })
    expect(await saveChangeRequestReview(request, version, { action: 'clarify', note: '  Which layout?  ' }))
      .toEqual({ ok: true, status: 'clarification_requested' })
    expect(mocks.rpc).toHaveBeenCalledWith('review_event_change_request', {
      p_request_id: request.id, p_event_updated_at: version, p_review: { action: 'clarify', note: 'Which layout?' },
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-007.7.8: an empty clarification message prevents saving', async () => {
    expect(await saveChangeRequestReview(request, version, { action: 'clarify', note: '' }))
      .toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.clarificationRequired })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-007.7.17: sends provisional field decisions and questions without changing them to a whole-request note', async () => {
    mocks.rpc.mockResolvedValue({ data: 'clarification_requested', error: null })
    const review = { action: 'decide', decisions: [approved.decisions[0], {
      field: 'expectedAttendance', decision: 'clarification_requested', note: 'Does this include staff?',
    }] }
    expect(await saveChangeRequestReview(request, version, review))
      .toEqual({ ok: true, status: 'clarification_requested' })
    expect(mocks.rpc).toHaveBeenCalledWith('review_event_change_request', {
      p_request_id: request.id, p_event_updated_at: version, p_review: review,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-007.7.18: a blank field question blocks the RPC even when another field is approved', async () => {
    expect(await saveChangeRequestReview(request, version, { action: 'decide', decisions: [
      approved.decisions[0], { field: 'expectedAttendance', decision: 'clarification_requested', note: '  ' },
    ] })).toEqual({ ok: false, reason: CHANGE_REVIEW_MESSAGES.clarificationRequired })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-007.7.19: does not report success if the server returns partial approval for an unresolved request', async () => {
    mocks.rpc.mockResolvedValue({ data: 'partially_approved', error: null })
    expect(await saveChangeRequestReview(request, version, { action: 'decide', decisions: [
      approved.decisions[0], { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Why more?' },
    ] })).toEqual({ ok: false, reason: messages.failed })
  })
})

describe('AC-007.9 — preserve the database checks on accepted changes', () => {
  test('AC-007.9.23: database value and constraint refusals return safe guidance without retrying or updating the event directly', async () => {
    for (const code of ['22000', '22003', '22007', '22008', '22P02', '23514']) {
      mocks.rpc.mockClear().mockResolvedValue({ data: null, error: { code, message: 'Private database detail' } })
      expect(await saveChangeRequestReview(request, version, approved))
        .toEqual({ ok: false, reason: messages.invalidEvent })
      expect(mocks.rpc).toHaveBeenCalledTimes(1)
      expect(mocks.rpc).toHaveBeenCalledWith('review_event_change_request', {
        p_request_id: request.id, p_event_updated_at: version, p_review: approved,
      })
      expect(mocks.from).not.toHaveBeenCalled()
    }
  })

  test.each([
    ['AC-007.9.12', ''], ['AC-007.9.13', 'invalid timestamp'],
  ])('%s: refuses missing or invalid comparison versions', async (_id, timestamp) => {
    expect(await saveChangeRequestReview(request, timestamp, approved)).toEqual({ ok: false, reason: messages.reload })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-007.9.14: reports a rejected resulting event without attempting a direct update', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'Accepted changes would leave invalid event details' } })
    expect(await saveChangeRequestReview(request, version, approved)).toEqual({ ok: false, reason: messages.invalidEvent })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('AC-007.10 — rejection leaves event details alone', () => {
  test('AC-007.10.2: sends a full rejection without issuing any event update', async () => {
    mocks.rpc.mockResolvedValue({ data: 'rejected', error: null })
    const review = { action: 'decide', decisions: approved.decisions.map((decision) => ({
      ...decision, decision: 'rejected', note: 'Keep the current arrangements.',
    })) }
    expect(await saveChangeRequestReview(request, version, review)).toEqual({ ok: true, status: 'rejected' })
    expect(mocks.rpc).toHaveBeenCalledWith('review_event_change_request', {
      p_request_id: request.id, p_event_updated_at: version, p_review: review,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
