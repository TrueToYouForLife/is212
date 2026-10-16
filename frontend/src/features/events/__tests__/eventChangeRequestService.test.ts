import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CHANGE_REQUEST_MESSAGES,
  LOCKED_STATUSES,
  requestEventChange,
  withdrawChangeRequest,
} from '../eventChangeRequestService'
import { changeRequest, eventId } from './fixtures/changeRequestReview'

/**
 * Service-level coverage for US6, grouped by the acceptance criterion each case verifies.
 *
 * The service is the enforcement point, not the form: every rule checked here is checked
 * again in the UI for the organiser's benefit, but a direct call must not be able to
 * bypass it. That is why ownership, event state and the single-pending rule all have
 * cases here as well as on the page.
 */

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))

const proposedChanges = changeRequest.proposedChanges
const reason = changeRequest.reason

function eventStatusQuery(status: string | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: status ? { status } : null, error }),
  }
}
function pendingCheckQuery(existing: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error }),
  }
}
function insertQuery(data: unknown, error: unknown = null) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
}
function updateQuery(data: unknown, error: unknown = null) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}
/** The happy path needs three queries in order: event status, pending check, insert. */
function stubSubmission(status = 'submitted', existingPending: unknown = null) {
  const insertChain = insertQuery({ id: changeRequest.id })
  mocks.from
    .mockReturnValueOnce(eventStatusQuery(status))
    .mockReturnValueOnce(pendingCheckQuery(existingPending))
    .mockReturnValueOnce(insertChain)
  return insertChain
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'organiser-1' } }, error: null })
})

describe('AC-006.1 — changes can only be requested for events belonging to the organiser', () => {
  test('AC-006.1.1: an event that could not be found is refused rather than silently allowed', async () => {
    // A missing row and a row RLS hides are indistinguishable here, deliberately: telling
    // the caller which would confirm that someone else's event exists.
    mocks.from.mockReturnValueOnce(eventStatusQuery(null))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.eventNotFound })
  })

  test('AC-006.1.2: a request with no signed-in user is refused before any database call', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-006.1.3: a session lookup failure is treated as not signed in, not as permission', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'network' } })
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn })
  })

  test('AC-006.1.4: the organiser recorded on the request is the signed-in user, not a parameter', async () => {
    // Ownership is taken from the session, so a caller cannot file a request as someone
    // else even by passing a different id in the payload.
    const insertChain = stubSubmission()
    await requestEventChange(eventId, proposedChanges, reason)
    expect(insertChain.insert.mock.calls[0][0].organiser_id).toBe('organiser-1')
  })

  test('AC-006.1.5: a row-level-security refusal is reported as a permission problem', async () => {
    // The database is the real control. If RLS refuses the insert because the event is not
    // the caller's, that must surface as "not permitted", not as a generic failure.
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingCheckQuery(null))
      .mockReturnValueOnce(insertQuery(null, { code: '42501' }))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.rlsDenied })
  })
})

describe('AC-006.2 — changes can only be requested while the event state permits it', () => {
  // IDs are written out rather than generated with %$, which this version of Vitest
  // prints literally — and a generated ID cannot be found by grepping for it or matched
  // against the row in the shared test-case sheet.
  test.each([
    ['AC-006.2.1', 'cancelled'],
    ['AC-006.2.2', 'completed'],
    ['AC-006.2.3', 'rejected'],
  ])('%s: blocks a change request when the event status is %s', async (_id, status) => {
    const insertChain = insertQuery({ id: changeRequest.id })
    mocks.from.mockReturnValueOnce(eventStatusQuery(status)).mockReturnValue(insertChain)

    const result = await requestEventChange(eventId, proposedChanges, reason)

    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.eventLocked })
    // Asserting the refusal alone would still pass if the guard returned the message and
    // wrote the row anyway. The absence of the write is the behaviour that matters.
    expect(insertChain.insert).not.toHaveBeenCalled()
  })

  test('AC-006.2.12: the blocked list is exactly the three statuses AC-006.2 names', async () => {
    // Pins the list against the criterion, not against the implementation — the mistake
    // that let the original defect survive was a test written the other way round. It
    // also keeps the page gate and the service gate from drifting, since both read this
    // constant and the cases above enumerate it.
    expect([...LOCKED_STATUSES].sort()).toEqual(['cancelled', 'completed', 'rejected'])
  })

  test('AC-006.2.4: a permitted status is allowed straight through to the insert', async () => {
    // The complement of the blocked cases above: without this, a guard that refused
    // everything would still pass them.
    const insertChain = stubSubmission('submitted')
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: true, requestId: changeRequest.id })
    expect(insertChain.insert).toHaveBeenCalled()
  })

  test('AC-006.2.5: a second pending request on the same event is refused', async () => {
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingCheckQuery({ id: 'existing-pending' }))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.alreadyPending })
  })

  test('AC-006.2.6: the pending check looks only for submitted requests, so a settled one does not block', async () => {
    // Boundary on the guard above: the query filters status = 'submitted', so a withdrawn
    // or reviewed request leaves the organiser free to raise another. Asserted through the
    // filters the service sends rather than by trusting the stub to return nothing.
    const pendingChain = pendingCheckQuery(null)
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingChain)
      .mockReturnValueOnce(insertQuery({ id: changeRequest.id }))

    const result = await requestEventChange(eventId, proposedChanges, reason)

    expect(result).toEqual({ ok: true, requestId: changeRequest.id })
    expect(pendingChain.eq).toHaveBeenCalledWith('status', 'submitted')
  })

  test('AC-006.2.7: a confirmed event can still be changed, which is the story\'s main case', async () => {
    // Regression test for the other half of the LOCKED_STATUSES defect. The list held
    // 'confirmed' instead of 'completed', so the one scenario AC-006.9 is written for —
    // proposing changes to a confirmed event while its original details stay in force —
    // was the one scenario the guard refused.
    const insertChain = stubSubmission('confirmed')

    const result = await requestEventChange(eventId, proposedChanges, reason)

    expect(result).toEqual({ ok: true, requestId: changeRequest.id })
    expect(insertChain.insert).toHaveBeenCalled()
  })
})

describe('AC-006.4 — proposed values are captured as a pending request, not applied', () => {
  test('AC-006.4.1: a valid request is recorded as a pending row with the proposed values', async () => {
    const insertChain = stubSubmission()
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: true, requestId: changeRequest.id })
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_id: eventId, organiser_id: 'organiser-1', proposed_changes: proposedChanges,
      reason, status: 'submitted',
    }))
  })

  test('AC-006.4.2: an empty set of proposed changes is refused before any database call', async () => {
    const result = await requestEventChange(eventId, {}, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-006.4.3: a database CHECK violation on the proposal is reported in the organiser\'s terms', async () => {
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingCheckQuery(null))
      .mockReturnValueOnce(insertQuery(null, { code: '23514' }))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
  })

  test('AC-006.4.4: a deleted event surfaces as "not found" rather than a raw constraint error', async () => {
    // The foreign key fires if the event disappears between the status read and the insert.
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingCheckQuery(null))
      .mockReturnValueOnce(insertQuery(null, { code: '23503' }))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.eventNotFound })
  })
})

describe('AC-006.5 — the organiser provides a reason for the requested change', () => {
  test('AC-006.5.1: a blank reason is refused before any database call', async () => {
    const result = await requestEventChange(eventId, proposedChanges, '')
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.reasonRequired })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-006.5.2: a reason of only whitespace is refused, not stored as a blank reason', async () => {
    // Boundary: the field is non-empty but carries no explanation, which is the case a
    // length check alone would let through.
    const result = await requestEventChange(eventId, proposedChanges, '   \n\t ')
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.reasonRequired })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-006.5.3: a single character is enough of a reason to be accepted', async () => {
    // The other side of the boundary. The rule is "said something", not "said enough" —
    // judging sufficiency is the coordinator's job, not the form's.
    const insertChain = stubSubmission()
    const result = await requestEventChange(eventId, proposedChanges, 'x')
    expect(result.ok).toBe(true)
    expect(insertChain.insert.mock.calls[0][0].reason).toBe('x')
  })

  test('AC-006.5.4: the reason reaches the database exactly as the organiser wrote it', async () => {
    const insertChain = stubSubmission()
    await requestEventChange(eventId, proposedChanges, '  Venue is too small.  ')
    expect(insertChain.insert.mock.calls[0][0].reason).toBe('  Venue is too small.  ')
  })
})

describe('AC-006.6 — the request is submitted to the coordinator for review', () => {
  test('AC-006.6.1: the request is stored with status submitted so it enters the review queue', async () => {
    const insertChain = stubSubmission()
    await requestEventChange(eventId, proposedChanges, reason)
    expect(insertChain.insert.mock.calls[0][0].status).toBe('submitted')
  })

  test('AC-006.6.2: the new request id is returned so the organiser can be shown it', async () => {
    stubSubmission()
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: true, requestId: changeRequest.id })
  })

  test('AC-006.6.3: an unrecognised database error gives advice, not raw Postgres text', async () => {
    mocks.from
      .mockReturnValueOnce(eventStatusQuery('submitted'))
      .mockReturnValueOnce(pendingCheckQuery(null))
      .mockReturnValueOnce(insertQuery(null, { code: '08006', message: 'connection failure' }))
    const result = await requestEventChange(eventId, proposedChanges, reason)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.unexpected })
    if (result.ok) return
    expect(result.reason).not.toContain('connection failure')
  })
})

describe('AC-006.8 — the organiser can withdraw a request before it is reviewed', () => {
  test('AC-006.8.3: withdrawal is scoped to the caller\'s own still-pending request', async () => {
    // Three filters, all required: the request, the owner, and the pending status. Dropping
    // the owner filter would let anyone withdraw anyone's request; dropping the status
    // filter would clobber a decision a coordinator had already made.
    const chain = updateQuery({ id: changeRequest.id })
    mocks.from.mockReturnValue(chain)

    const result = await withdrawChangeRequest(changeRequest.id)

    expect(result).toEqual({ ok: true })
    expect(chain.update).toHaveBeenCalledWith({ status: 'withdrawn' })
    expect(chain.eq).toHaveBeenCalledWith('id', changeRequest.id)
    expect(chain.eq).toHaveBeenCalledWith('organiser_id', 'organiser-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'submitted')
  })

  test('AC-006.8.4: a request reviewed in the meantime matches nothing and is reported, not overwritten', async () => {
    // Conflict case: the coordinator decided between the page loading and the click. The
    // status filter matches zero rows, and that must read as "too late", not as success.
    mocks.from.mockReturnValue(updateQuery(null))
    const result = await withdrawChangeRequest(changeRequest.id)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.notWithdrawable })
  })

  test('AC-006.8.5: withdrawal with no signed-in user is refused before any database call', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await withdrawChangeRequest(changeRequest.id)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-006.8.6: a database error during withdrawal is translated, not surfaced raw', async () => {
    mocks.from.mockReturnValue(updateQuery(null, { code: '42501' }))
    const result = await withdrawChangeRequest(changeRequest.id)
    expect(result).toEqual({ ok: false, reason: CHANGE_REQUEST_MESSAGES.rlsDenied })
  })
})

describe('AC-006.9 — the original details stay in force until the request is approved', () => {
  test('AC-006.9.1: submitting a change request never writes to the events table', async () => {
    // The whole point of the pending row: the event is untouched until US7 approves. The
    // events table is read once, for the status guard, and never written.
    stubSubmission()
    await requestEventChange(eventId, proposedChanges, reason)

    const eventsCalls = mocks.from.mock.calls.filter(([table]) => table === 'events')
    expect(eventsCalls).toHaveLength(1)
  })

  test('AC-006.9.2: the proposal is stored on the request row, not merged into the event', async () => {
    const insertChain = stubSubmission()
    await requestEventChange(eventId, proposedChanges, reason)

    expect(mocks.from).toHaveBeenCalledWith('event_change_requests')
    expect(insertChain.insert.mock.calls[0][0].proposed_changes).toEqual(proposedChanges)
  })
})

describe('AC-006.10 — the request records who asked and when', () => {
  test('AC-006.10.1: the organiser comes from the session and the time is left to the database', async () => {
    // The audit trail is structural rather than a separate log call: organiser_id comes
    // from the authenticated session, and submitted_at is the database's own default. A
    // client that could state either could backdate or misattribute a request.
    const insertChain = stubSubmission()
    await requestEventChange(eventId, proposedChanges, reason)

    const insertedRow = insertChain.insert.mock.calls[0][0]
    expect(insertedRow.organiser_id).toBe('organiser-1')
    expect(insertedRow).not.toHaveProperty('submitted_at')
    expect(insertedRow).not.toHaveProperty('reviewed_at')
  })

  test('AC-006.10.2: a client-supplied organiser or timestamp in the proposal is not promoted to a column', async () => {
    // Boundary on the above: even if a caller smuggles these into the proposed changes,
    // they stay inside the JSON proposal and never become the row's attribution.
    const insertChain = stubSubmission()
    await requestEventChange(
      eventId,
      { ...proposedChanges, organiser_id: 'someone-else', submitted_at: '1999-01-01' } as never,
      reason,
    )

    const insertedRow = insertChain.insert.mock.calls[0][0]
    expect(insertedRow.organiser_id).toBe('organiser-1')
    expect(insertedRow).not.toHaveProperty('submitted_at')
  })
})
