import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CHANGE_REVIEW_LOAD_MESSAGES as messages, getChangeRequestReviewContext } from '../changeRequestReviewQueryService'
import { changeRequestRow, coordinatorId, eventId, reviewContext, replyRound } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))
const row = {
  id: eventId, coordinator_id: coordinatorId, status: 'confirmed', updated_at: reviewContext.eventUpdatedAt,
  name: 'Original title', purpose: 'Meet', event_type: 'Conference', description: 'Public workshop',
  proposed_start: '2030-01-01T01:00:00Z', proposed_end: '2030-01-01T02:00:00Z', expected_attendance: 50,
  programme: 'Welcome', layout_preference: 'theatre', accessibility_requirements: ['wheelchair_access'],
  facility_requirements: ['wifi'], equipment_requirements: ['portable_projector'],
  registration_required: false, special_arrangements: null,
  event_change_requests: [changeRequestRow],
}
function query(data: unknown = row, error: unknown = null) {
  const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) }
  mocks.from.mockReturnValue(read)
  return read
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: coordinatorId } }, error: null })
})

describe('AC-007.2 — load assigned reviews only', () => {
  test.each([
    ['AC-007.2.24', { data: { user: null }, error: null }],
    ['AC-007.2.25', { data: { user: { id: coordinatorId } }, error: { message: 'Expired' } }],
  ])('%s: signed-out or expired sessions cannot load the comparison', async (_id, session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.unavailable })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  test.each([
    ['AC-007.2.26', null], ['AC-007.2.27', { ...row, coordinator_id: 'someone-else' }],
  ])('%s: missing or differently assigned events expose no review data', async (_id, data) => {
    query(data)
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.unavailable })
  })
  test('AC-007.2.28: an invalid event ID does not contact Supabase', async () => {
    expect(await getChangeRequestReviewContext('invalid')).toEqual({ ok: false, reason: messages.unavailable })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
})

describe('AC-007.3 — comparison data', () => {
  test('AC-007.3.1: loads current values, version and field decisions in one assignment-filtered query', async () => {
    const decision = { field: 'name', decision: 'clarification_requested', note: 'Which title?' }
    const read = query({ ...row, event_change_requests: [
      changeRequestRow,
      { ...changeRequestRow, id: 'newer', review_version: 4, reply_history: [replyRound], submitted_at: '2026-09-26T01:00:00Z', field_decisions: [decision] },
    ] })
    const result = await getChangeRequestReviewContext(eventId)
    expect(result).toMatchObject({ ok: true, context: {
      eventUpdatedAt: reviewContext.eventUpdatedAt, eventStatus: 'confirmed',
      currentValues: { name: 'Original title', purpose: 'Meet', eventType: 'Conference',
        description: 'Public workshop', proposedStart: row.proposed_start, proposedEnd: row.proposed_end,
        expectedAttendance: 50, programme: 'Welcome', layoutPreference: 'theatre',
        accessibilityRequirements: ['wheelchair_access'], facilityRequirements: ['wifi'],
        equipmentRequirements: ['portable_projector'], registrationRequired: false, specialArrangements: '' },
      requests: [{ id: 'newer', reviewVersion: 4, replyHistory: [replyRound], fieldDecisions: [decision] }, { id: changeRequestRow.id, fieldDecisions: [] }],
    } })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(read.select.mock.calls[0][0]).toContain('event_change_requests(')
    expect(read.eq.mock.calls).toEqual([['id', eventId], ['coordinator_id', coordinatorId]])
  })
  test('AC-007.3.2: database failures are not returned as an empty request list', async () => {
    query(null, { message: 'private schema details' })
    expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: false, reason: messages.failed })
  })
  test('AC-007.3.3: a lost connection returns a recoverable loading error', async () => {
    query().maybeSingle.mockRejectedValue(new Error('Offline'))
    await expect(getChangeRequestReviewContext(eventId)).resolves.toEqual({ ok: false, reason: messages.failed })
  })
})

test('AC-007.3.11: optional details remain blank while a successful empty review list keeps the assigned event context', async () => {
  query({ ...row, status: 'under_review', name: null, event_type: null, description: null, programme: null,
    layout_preference: null, special_arrangements: 'Use the side entrance',
    accessibility_requirements: [], facility_requirements: [], equipment_requirements: [],
    event_change_requests: [],
  })
  expect(await getChangeRequestReviewContext(eventId)).toEqual({ ok: true, context: {
    eventId, eventStatus: 'under_review', eventUpdatedAt: reviewContext.eventUpdatedAt,
    currentValues: { name: '', purpose: row.purpose, eventType: '',
      description: '', proposedStart: row.proposed_start, proposedEnd: row.proposed_end,
      expectedAttendance: 50, programme: '', layoutPreference: '', specialArrangements: 'Use the side entrance',
      accessibilityRequirements: [], facilityRequirements: [], equipmentRequirements: [],
      registrationRequired: false },
    requests: [],
  } })
  expect(mocks.from).toHaveBeenCalledTimes(1)
})

test('AC-007.13.31: embeds and maps retained history newest version first', async () => {
  const history = { id: 'old', request_version: 1, outcome: 'clarification_requested',
    proposed_changes: { name: 'Historical title' }, field_decisions: [], review_note: 'Explain?',
    reviewer_name: 'Jane', reviewed_at: '2026-09-27T01:00:00Z' }
  const read = query({ ...row, event_change_requests: [{ ...changeRequestRow,
    event_change_review_history: [history, { ...history, id: 'new', request_version: 3, outcome: 'approved' }],
  }] })
  const result = await getChangeRequestReviewContext(eventId)
  expect(read.select.mock.calls[0][0]).toContain('event_change_review_history(')
  expect(result).toMatchObject({ ok: true, context: { requests: [{ reviewHistory: [
    { id: 'new', requestVersion: 3, outcome: 'approved' },
    { id: 'old', reviewerName: 'Jane', proposedChanges: { name: 'Historical title' }, reviewNote: 'Explain?' },
  ] }] } })
})
