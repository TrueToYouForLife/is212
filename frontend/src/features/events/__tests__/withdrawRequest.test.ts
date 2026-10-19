import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  REVIEW_MESSAGES, transitionEventStatus,
} from '../eventReviewService'
import {
  STATUS_TRANSITIONS, canActorTransition, canTransition, reviewActionsFor,
} from '../statusRules'
import { EVENT_STATUS_LABELS } from '../types'
import { organiserStatusLabel } from '../status/organiserStatusLabel'

/**
 * US22 — Withdraw a submitted request (SCRUM-67).
 *
 * A coordinator closes a request that is awaiting a decision, without rejecting it. The
 * rules live in 0066_withdraw_submitted_request.sql and are mirrored in statusRules.ts
 * for the UI, the same defence-in-depth split the rest of the workflow uses: the
 * database decides, this decides which buttons to show.
 *
 * Authorisation is not re-tested here. It is already settled by two existing guards —
 * enforce_event_status_transition (0006) restricts an organiser to submitted/cancelled,
 * and guard_assigned_coordinator_event_update (0039) refuses any coordinator who is not
 * the assigned one. The SQL suite covers both.
 */

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from, rpc: mocks.rpc },
}))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'
const COORDINATOR = { role: 'coordinator' as const, isOwner: false }
const OWNER = { role: 'organiser' as const, isOwner: true }

/** The generic status update path: update → eq(id) → eq(status) → select → maybeSingle. */
function stubUpdate(data: { id: string; status: string } | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error })
  const select = vi.fn(() => ({ maybeSingle }))
  const eqStatus = vi.fn(() => ({ select }))
  const eqId = vi.fn(() => ({ eq: eqStatus }))
  const update = vi.fn(() => ({ eq: eqId }))
  mocks.from.mockReturnValue({ update })
  return { update, eqId, eqStatus }
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-022.1 — a Coordinator can withdraw a request under review', () => {
  test('AC-022.1.1: a submitted request can be withdrawn', async () => {
    // 'submitted' shows to the organiser as "In review", so it is one of the two states
    // the criterion covers.
    expect(canTransition('submitted', 'withdrawn')).toBe(true)
  })

  test('AC-022.1.2: a request already taken under review can be withdrawn', async () => {
    expect(canTransition('under_review', 'withdrawn')).toBe(true)
  })

  test('AC-022.1.3: the assigned coordinator is offered the action on both states', () => {
    expect(canActorTransition(COORDINATOR, 'submitted', 'withdrawn')).toBe(true)
    expect(canActorTransition(COORDINATOR, 'under_review', 'withdrawn')).toBe(true)
  })

  test('AC-022.1.4: "Withdraw request" appears among a reviewer\'s actions, as a danger action', () => {
    const actions = reviewActionsFor('under_review')
    const withdraw = actions.find((action) => action.to === 'withdrawn')
    expect(withdraw).toEqual({ to: 'withdrawn', label: 'Withdraw request', tone: 'danger' })
  })

  test('AC-022.1.5: the organiser is not offered it — withdrawal is the reviewer\'s decision', () => {
    // The organiser's own close is 'cancelled'. Mirrors the 0006 trigger, which restricts
    // an organiser to submitted/cancelled on their own event.
    expect(canActorTransition(OWNER, 'submitted', 'withdrawn')).toBe(false)
    expect(canActorTransition(OWNER, 'under_review', 'withdrawn')).toBe(false)
  })

  test('AC-022.1.6: a withdrawal reaches the database as a plain status update, not the review RPC', () => {
    // 0012's review_submitted_event covers approved/rejected/returned only. Withdrawal
    // must take the generic update path, which carries the expected-status filter.
    stubUpdate({ id: EVENT_ID, status: 'withdrawn' })
    return transitionEventStatus({
      id: EVENT_ID, from: 'submitted', to: 'withdrawn', actor: COORDINATOR,
      note: 'The client cancelled the programme.',
    }).then((result) => {
      expect(result).toEqual({ ok: true, status: 'withdrawn' })
      expect(mocks.rpc).not.toHaveBeenCalled()
    })
  })

  test('AC-022.1.7: the update is filtered on the status the reviewer was shown', async () => {
    // Optimistic concurrency: if someone approved it in the meantime the filter matches
    // nothing, rather than overwriting their decision with a withdrawal.
    const { update, eqId, eqStatus } = stubUpdate({ id: EVENT_ID, status: 'withdrawn' })

    await transitionEventStatus({
      id: EVENT_ID, from: 'under_review', to: 'withdrawn', actor: COORDINATOR,
      note: 'Duplicate request.',
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'withdrawn', review_note: 'Duplicate request.' }),
    )
    expect(eqId).toHaveBeenCalledWith('id', EVENT_ID)
    expect(eqStatus).toHaveBeenCalledWith('status', 'under_review')
  })

  test('AC-022.1.8: a request decided in the meantime is reported, not overwritten', async () => {
    // Conflict case: zero rows matched because the status moved on.
    stubUpdate(null)
    const result = await transitionEventStatus({
      id: EVENT_ID, from: 'submitted', to: 'withdrawn', actor: COORDINATOR, note: 'Too late.',
    })
    expect(result).toEqual({ ok: false, reason: REVIEW_MESSAGES.illegalTransition })
  })

  test('AC-022.1.9: a withdrawal with no reason is refused before any query runs', async () => {
    // AC-022 does not require a reason; this matches rejection and return, so a closed
    // request always carries an explanation in event_review_decisions.
    stubUpdate({ id: EVENT_ID, status: 'withdrawn' })
    const result = await transitionEventStatus({
      id: EVENT_ID, from: 'submitted', to: 'withdrawn', actor: COORDINATOR, note: '   ',
    })
    expect(result).toEqual({ ok: false, reason: REVIEW_MESSAGES.noteRequired })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('AC-022.1.10: a permission refusal from the database is reported as one', async () => {
    // 42501 is what guard_assigned_coordinator_event_update raises for a coordinator who
    // is not the assignee. The UI hides the button; this is what happens if it is called.
    stubUpdate(null, { code: '42501' })
    const result = await transitionEventStatus({
      id: EVENT_ID, from: 'submitted', to: 'withdrawn', actor: COORDINATOR,
      note: 'Not my event.',
    })
    expect(result).toEqual({ ok: false, reason: REVIEW_MESSAGES.notPermitted })
  })
})

describe('AC-022.2 — a withdrawn event is marked Withdrawn and stays distinguishable', () => {
  test('AC-022.2.1: the status reads as "Withdrawn"', () => {
    expect(EVENT_STATUS_LABELS.withdrawn).toBe('Withdrawn')
  })

  test('AC-022.2.2: the organiser sees "Withdrawn", not "In review" or a rejection', () => {
    expect(organiserStatusLabel('withdrawn')).toBe('Withdrawn')
    expect(organiserStatusLabel('withdrawn', 'Some note')).toBe('Withdrawn')
  })

  test('AC-022.2.3: it is its own value, distinct from the four the criterion names', () => {
    // The point of the criterion: a withdrawn request must not be mistaken for a draft,
    // one still awaiting review, an approval, or a rejection.
    const others = ['draft', 'submitted', 'approved', 'rejected'] as const
    for (const status of others) {
      expect(EVENT_STATUS_LABELS[status]).not.toBe(EVENT_STATUS_LABELS.withdrawn)
    }
  })

  test('AC-022.2.4: it is also distinct from cancelled, which means something else', () => {
    // Not named in AC-022.2, but the distinction is the reason this is a new status
    // rather than a reuse: cancelled is an event that was going ahead and then was not.
    expect(EVENT_STATUS_LABELS.cancelled).not.toBe(EVENT_STATUS_LABELS.withdrawn)
    expect(canTransition('confirmed', 'withdrawn')).toBe(false)
  })

  test('AC-022.2.5: withdrawn is terminal — reviving a request means filing a new one', () => {
    // Same rule as completed, cancelled and rejected, and for the same reason: a status
    // that can be reversed makes the audit trail unreadable.
    expect(STATUS_TRANSITIONS.withdrawn).toEqual([])
  })

  test('AC-022.2.6: nothing can be withdrawn once a decision has been made', () => {
    // Boundary on AC-022.1's "under review": every other starting state refuses.
    const notUnderReview = ['draft', 'approved', 'planning', 'confirmed',
                            'completed', 'cancelled', 'rejected', 'withdrawn'] as const
    for (const from of notUnderReview) {
      expect(canTransition(from, 'withdrawn')).toBe(false)
    }
  })

  test('AC-022.2.7: a withdrawn request offers no further review actions', () => {
    expect(reviewActionsFor('withdrawn')).toEqual([])
  })
})
