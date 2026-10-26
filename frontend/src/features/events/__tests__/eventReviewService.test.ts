import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  REVIEW_MESSAGES,
  getEventRequest,
  listEventRequests,
  listReviewDecisions,
  transitionEventStatus,
} from '../eventReviewService'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from },
}))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'

function mockList(response: { data: unknown[] | null; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(response)
  const neq = vi.fn((_column: string, _value: string) => ({ order }))
  const select = vi.fn((_columns: string) => ({ neq }))
  mocks.from.mockReturnValue({ select })
  return { select, neq, order }
}

function mockUpdate(response: {
  data: { id: string; status: string } | null
  error: { message: string } | null
}) {
  const maybeSingle = vi.fn().mockResolvedValue(response)
  const select = vi.fn((_columns: string) => ({ maybeSingle }))
  const eqStatus = vi.fn((_column: string, _value: string) => ({ select }))
  const eqId = vi.fn((_column: string, _value: string) => ({ eq: eqStatus }))
  const update = vi.fn((_values: Record<string, unknown>) => ({ eq: eqId }))
  mocks.from.mockReturnValue({ update })
  return { update, eqId, eqStatus }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AC-004.1 — coordinator views submitted request details', () => {
  test('AC-004.1.1: drafts are excluded — an unsubmitted draft is the organiser private working copy', async () => {
    const { neq } = mockList({ data: [], error: null })

    await listEventRequests()

    expect(neq).toHaveBeenCalledWith('status', 'draft')
  })

  test('AC-004.1.2: maps database columns onto the shape the UI renders', async () => {
    mockList({
      data: [
        {
          id: EVENT_ID,
          reference: 'EVT-2026-0001',
          organiser_id: 'organiser-1',
          name: 'Client dinner',
          purpose: 'Thank our clients',
          event_type: 'Dinner',
          proposed_start: '2099-06-01T18:00:00Z',
          proposed_end: '2099-06-01T22:00:00Z',
          expected_attendance: 120,
          status: 'submitted',
          submitted_at: '2026-01-05T02:11:00Z',
        },
      ],
      error: null,
    })

    const result = await listEventRequests()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.requests[0]).toMatchObject({
      id: EVENT_ID,
      reference: 'EVT-2026-0001',
      organiserId: 'organiser-1',
      eventType: 'Dinner',
      expectedAttendance: 120,
      status: 'submitted',
    })
  })

  test('AC-004.1.3: a database error is reported to the user without leaking the schema', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockList({ data: null, error: { message: 'column events.review_note does not exist' } })

    const result = await listEventRequests()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.loadFailed)
    // The detail is still available to a developer, just not to the organiser.
    expect(result.reason).not.toContain('review_note')
    expect(console.error).toHaveBeenCalled()
  })
})

describe('AC-004.2 / AC-004.3 — coordinator accepts/rejects with a reason', () => {
  const coordinator = { role: 'coordinator', isOwner: false } as const

  test('AC-004.2.17: a coordinator can take a submitted request under review', async () => {
    mockUpdate({ data: { id: EVENT_ID, status: 'under_review' }, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'submitted',
      to: 'under_review',
      actor: coordinator,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('under_review')
  })

  test('AC-004.2.18: an illegal transition is refused before it reaches the database', async () => {
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'draft',
      to: 'approved',
      actor: coordinator,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.notPermitted)
    expect(update).not.toHaveBeenCalled()
  })

  test('AC-004.2.19: an organiser cannot approve their own request', async () => {
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: { role: 'organiser', isOwner: true },
    })

    expect(result.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  test('AC-004.3.1: a rejection without a reason is refused', async () => {
    // A rejection the organiser cannot act on is not a review.
    const { update } = mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'rejected',
      actor: coordinator,
      note: '   ',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.noteRequired)
    expect(update).not.toHaveBeenCalled()
  })

  test('AC-004.3.2: a rejection with a reason records the note (also AC-004.5)', async () => {
    const { update } = mockUpdate({ data: { id: EVENT_ID, status: 'rejected' }, error: null })

    await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'rejected',
      actor: coordinator,
      note: '  The hall is closed for refurbishment that week.  ',
    })

    expect(update).toHaveBeenCalledWith({
      status: 'rejected',
      review_note: 'The hall is closed for refurbishment that week.',
    })
  })

  test('AC-004.2.20: the update is scoped to the status we believe the request is in', async () => {
    // Optimistic concurrency: if another coordinator has moved it, we must not overwrite them.
    const { eqStatus } = mockUpdate({ data: { id: EVENT_ID, status: 'approved' }, error: null })

    await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: coordinator,
    })

    expect(eqStatus).toHaveBeenCalledWith('status', 'under_review')
  })

  test('AC-004.2.21: a request another coordinator has already moved is reported, not overwritten', async () => {
    mockUpdate({ data: null, error: null })

    const result = await transitionEventStatus({
      id: EVENT_ID,
      from: 'under_review',
      to: 'approved',
      actor: coordinator,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(REVIEW_MESSAGES.illegalTransition)
  })
})

describe('AC-004.5 — a record of each decision is retained', () => {
  function mockDecisions(response: { data: unknown[] | null; error: { message: string } | null }) {
    const order = vi.fn().mockResolvedValue(response)
    const eq = vi.fn((_column: string, _value: string) => ({ order }))
    const select = vi.fn((_columns: string) => ({ eq }))
    mocks.from.mockReturnValue({ select })
    return { select, eq, order }
  }

  test('AC-004.5.1: lists the decision, reason and reviewer for a request, newest first', async () => {
    const { select, eq, order } = mockDecisions({
      data: [
        {
          id: 'decision-2', from_status: 'under_review', decision: 'approved', reason: null,
          decided_by_name: 'Casey Coordinator', decided_at: '2026-09-21T09:00:00Z',
        },
        {
          id: 'decision-1', from_status: 'under_review', decision: 'returned',
          reason: 'Please add a programme.', decided_by_name: 'Casey Coordinator',
          decided_at: '2026-09-20T09:00:00Z',
        },
      ],
      error: null,
    })

    const result = await listReviewDecisions(EVENT_ID)

    expect(mocks.from).toHaveBeenCalledWith('event_review_decisions')
    expect(eq).toHaveBeenCalledWith('event_id', EVENT_ID)
    expect(order).toHaveBeenCalledWith('decided_at', { ascending: false })
    // Only the snapshot name is requested; the reviewer's user id stays in the database.
    expect(select.mock.calls[0][0]).not.toContain('decided_by,')
    expect(result).toEqual({
      ok: true,
      decisions: [
        {
          id: 'decision-2', fromStatus: 'under_review', decision: 'approved', reason: null,
          decidedByName: 'Casey Coordinator', decidedAt: '2026-09-21T09:00:00Z',
        },
        {
          id: 'decision-1', fromStatus: 'under_review', decision: 'returned',
          reason: 'Please add a programme.', decidedByName: 'Casey Coordinator',
          decidedAt: '2026-09-20T09:00:00Z',
        },
      ],
    })
  })

  test('AC-004.5.2: a malformed request ID returns unavailable without querying the database', async () => {
    expect(await listReviewDecisions('not-an-event-id')).toEqual({
      ok: false, reason: REVIEW_MESSAGES.notFound,
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-004.5.3: a failed history read is reported without leaking the schema', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockDecisions({ data: null, error: { message: 'relation event_review_decisions does not exist' } })

    const result = await listReviewDecisions(EVENT_ID)

    expect(result).toEqual({ ok: false, reason: REVIEW_MESSAGES.historyFailed })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('AC-003 — view event request status (SCRUM-24)', () => {
  test('AC-003.1.1: includes drafts when listing organiser requests', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null })
    const neq = vi.fn()
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ order, neq }) })
    expect(await listEventRequests(true)).toEqual({ ok: true, requests: [] })
    expect(neq).not.toHaveBeenCalled()
  })

  test('AC-003.2.1: retrieves the current database status and shared reason on each read', async () => {
    const row = {
      id: EVENT_ID, organiser_id: 'owner-1', status: 'submitted',
      reference: 'EVT-2026-0001', review_note: null,
    }
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { ...row, status: 'rejected', review_note: 'Venue unavailable' }, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })
    expect(await getEventRequest(EVENT_ID)).toMatchObject({
      ok: true, request: { id: EVENT_ID, organiserId: 'owner-1', status: 'submitted' },
    })
    expect(await getEventRequest(EVENT_ID)).toMatchObject({
      ok: true, request: { status: 'rejected', reviewNote: 'Venue unavailable' },
    })
    expect(eq).toHaveBeenCalledWith('id', EVENT_ID)
    expect(maybeSingle).toHaveBeenCalledTimes(2)
  })

  test('AC-003.6.1: forbidden and missing requests share the same response', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })
    expect(await getEventRequest(EVENT_ID)).toEqual({ ok: false, reason: REVIEW_MESSAGES.notFound })
    expect(eq).toHaveBeenCalledWith('id', EVENT_ID)
    expect(select.mock.calls[0][0]).not.toContain('reviewed_by')
    expect(select.mock.calls[0][0]).not.toContain('*')
  })

  test('AC-003.6.2: malformed IDs return unavailable without querying the database', async () => {
    expect(await getEventRequest('not-an-event-id')).toEqual({ ok: false, reason: REVIEW_MESSAGES.notFound })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('remaining lifecycle persistence', () => {
  test.each([
    ['approved', 'planning'], ['in_preparation', 'confirmed'],
    ['confirmed', 'completed'], ['approved', 'cancelled'],
  ] as const)('AC-LIFECYCLE.5-%s-%s: persists the coordinator transition', async (from, to) => {
    const { update, eqStatus } = mockUpdate({ data: { id: EVENT_ID, status: to }, error: null })
    expect(await transitionEventStatus({ id: EVENT_ID, from, to,
      actor: { role: 'coordinator', isOwner: false } })).toEqual({ ok: true, status: to })
    expect(update).toHaveBeenCalledWith({ status: to, review_note: null })
    expect(eqStatus).toHaveBeenCalledWith('status', from)
  })

  test('AC-LIFECYCLE.2-01: manager lifecycle writes are denied before persistence', async () => {
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'approved', to: 'planning',
      actor: { role: 'operations_manager', isOwner: false } })).toEqual({ ok: false, reason: REVIEW_MESSAGES.notPermitted })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
test('AC-041.1.10: event detail fetches and maps current assignment for arrangement-review visibility', async () => {
  for (const coordinatorId of ['assigned-coordinator', null]) {
    const row = { id: EVENT_ID, organiser_id: 'organiser', coordinator_id: coordinatorId, status: 'approved' }
    // Model the projection: an omitted column cannot appear in the service result.
    const select = vi.fn((columns: string) => ({ eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: Object.fromEntries(Object.entries(row).filter(([key]) => columns.split(', ').includes(key))),
        error: null,
      }),
    }) }))
    mocks.from.mockReturnValue({ select })
    const result = await getEventRequest(EVENT_ID)
    expect(result).toMatchObject({ ok: true, request: { coordinatorId } })
    expect(select.mock.calls[0][0].split(', ')).toContain('coordinator_id')
  }
})
