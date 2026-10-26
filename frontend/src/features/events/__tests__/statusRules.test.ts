import { describe, expect, test } from 'vitest'
import {
  STATUS_TRANSITIONS,
  canActorTransition,
  canTransition,
  reviewActionsFor,
} from '../statusRules'
import { EVENT_STATUSES } from '../types'

/**
 * US4 — Review and Approve/Reject/Return an Event Request (SCRUM-9).
 *
 * These rules are duplicated in 0004_review.sql on purpose: the database is the control,
 * this is the error message. If you change one, change the other.
 */
describe('AC-004.2 — accept/reject workflow rules', () => {
  test('AC-004.2.1: every status is covered by the transition table', () => {
    // Guards against adding a status to the enum and forgetting the workflow, which would
    // otherwise fail at runtime with an undefined lookup.
    for (const status of EVENT_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined()
    }
  })

  test('AC-004.2.2: a submitted request can be taken under review', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true)
  })

  test('AC-004.2.3: a submitted request cannot jump straight to approved', () => {
    // Direct table updates retain the old graph; the RPC combines its two steps.
    expect(canTransition('submitted', 'approved')).toBe(false)
  })

  test('AC-004.2.4: a request under review can be returned to the organiser for more detail', () => {
    expect(canTransition('under_review', 'submitted')).toBe(true)
  })

  test.each([
    ['AC-004.2.5', 'completed'],
    ['AC-004.2.6', 'cancelled'],
    ['AC-004.2.7', 'rejected'],
  ] as const)('%s: a %s request is terminal and has no next step', (_caseId, status) => {
    expect(STATUS_TRANSITIONS[status]).toHaveLength(0)
  })
})

describe('AC-004.2 — who may perform a transition', () => {
  const coordinator = { role: 'coordinator', isOwner: false } as const
  const owner = { role: 'organiser', isOwner: true } as const
  const strangerOrganiser = { role: 'organiser', isOwner: false } as const

  test('AC-004.2.8: a coordinator can approve a request that is under review', () => {
    expect(canActorTransition(coordinator, 'under_review', 'approved')).toBe(true)
  })

  test('AC-004.2.9: an organiser cannot approve their own request', () => {
    // The entire reason a review step exists.
    expect(canActorTransition(owner, 'under_review', 'approved')).toBe(false)
  })

  test('AC-004.2.10: an organiser can submit their own draft', () => {
    expect(canActorTransition(owner, 'draft', 'submitted')).toBe(true)
  })

  test('AC-004.2.11: a coordinator cannot submit an organiser draft on their behalf', () => {
    expect(canActorTransition(coordinator, 'draft', 'submitted')).toBe(false)
  })

  test('AC-004.2.12: an organiser cannot touch another organiser request', () => {
    expect(canActorTransition(strangerOrganiser, 'submitted', 'cancelled')).toBe(false)
  })

  test('AC-004.2.13: an organiser can withdraw their own request', () => {
    expect(canActorTransition(owner, 'submitted', 'cancelled')).toBe(true)
  })
})

describe('AC-004.2 — actions offered to a coordinator', () => {
  test('AC-004.2.14: a newly submitted request offers approve, return, reject, withdraw and cancel', () => {
    // 'withdrawn' joined this list with US22 (0066): a request awaiting a decision can be
    // closed without being rejected. The assertion is a closed list on purpose — it is
    // what caught the addition, and it should keep catching the next one.
    expect(reviewActionsFor('submitted').map((action) => action.to))
      .toEqual(['approved', 'submitted', 'rejected', 'withdrawn', 'cancelled'])
  })

  test('AC-004.2.15: a request under review offers approve, return and reject', () => {
    const actions = reviewActionsFor('under_review').map((action) => action.to)
    expect(actions).toContain('approved')
    expect(actions).toContain('rejected')
    expect(actions).toContain('submitted')
  })

  test('AC-004.2.16: a rejected request offers nothing', () => {
    expect(reviewActionsFor('rejected')).toEqual([])
  })
})

describe('remaining lifecycle actions', () => {
  test.each([
    ['approved', ['planning', 'cancelled']],
    ['planning', ['confirmed', 'cancelled']],
    ['awaiting_safety_review', ['cancelled']],
    ['safety_changes_requested', ['cancelled']],
    ['in_preparation', ['confirmed', 'cancelled']],
    ['confirmed', ['completed', 'cancelled']],
    ['completed', []], ['cancelled', []], ['draft', []],
  ] as const)('AC-LIFECYCLE.1-%s: offers the permitted next steps', (status, expected) => {
    expect(reviewActionsFor(status).map((action) => action.to)).toEqual(expected)
  })

  test.each(['operations_manager', 'venue_staff', 'tech_support', 'attendee'] as const)(
    'AC-LIFECYCLE.2-%s: cannot change lifecycle even if they own a historical request', (role) => {
      expect(canActorTransition({ role, isOwner: true }, 'approved', 'planning')).toBe(false)
      expect(canActorTransition({ role, isOwner: true }, 'approved', 'cancelled')).toBe(false)
    },
  )
})