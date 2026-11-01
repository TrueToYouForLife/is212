import { describe, expect, test } from 'vitest'
import { STATUS_TRANSITIONS, canActorTransition, canTransition, hasEnded, reviewActionsFor } from '../statusRules'
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from '../types'

/**
 * US38 — Event status lifecycle (SCRUM-235), AC-038.1 and AC-038.2.
 * Mirrors is_valid_status_transition / enforce_event_status_transition in 0119.
 */
describe('AC-038.1 — the 14 statuses', () => {
  test('AC-038.1.1: exactly the 14 agreed statuses exist, each with a label', () => {
    // "Returned for Clarification" is submitted + a review note, not a stored status (team decision).
    expect(EVENT_STATUSES).toHaveLength(14)
    expect(new Set(EVENT_STATUSES).size).toBe(EVENT_STATUSES.length)
    for (const status of EVENT_STATUSES) expect(EVENT_STATUS_LABELS[status]).toBeTruthy()
    expect(EVENT_STATUS_LABELS.postponed).toBe('Postponed')
  })
})

describe('AC-038.2 — postponed transitions', () => {
  test('AC-038.2.1: Planning, In Preparation and Confirmed can be postponed', () => {
    for (const from of ['planning', 'in_preparation', 'confirmed'] as const) {
      expect(canTransition(from, 'postponed')).toBe(true)
    }
  })

  test('AC-038.2.2: a postponed event can only be re-planned or cancelled', () => {
    expect([...STATUS_TRANSITIONS.postponed].sort()).toEqual(['cancelled', 'planning'])
    expect(canTransition('postponed', 'confirmed')).toBe(false)
  })

  test('AC-038.2.3: earlier stages and closed events cannot be postponed (boundary)', () => {
    for (const from of ['draft', 'submitted', 'under_review', 'approved', 'completed', 'cancelled', 'rejected', 'withdrawn'] as const) {
      expect(canTransition(from, 'postponed')).toBe(false)
    }
  })

  test('AC-038.2.4: only the Coordinator postpones or resumes; the owning organiser cannot', () => {
    expect(canActorTransition({ role: 'coordinator', isOwner: false }, 'confirmed', 'postponed')).toBe(true)
    expect(canActorTransition({ role: 'coordinator', isOwner: false }, 'postponed', 'planning')).toBe(true)
    expect(canActorTransition({ role: 'organiser', isOwner: true }, 'confirmed', 'postponed')).toBe(false)
    expect(canActorTransition({ role: 'organiser', isOwner: true }, 'postponed', 'planning')).toBe(false)
  })

  test('AC-038.2.6: no other role can postpone or resume, but the owner can still cancel a postponed event', () => {
    for (const role of ['venue_staff', 'safety_officer', 'tech_support', 'attendee', 'coordinator_lead'] as const) {
      expect(canActorTransition({ role, isOwner: false }, 'confirmed', 'postponed')).toBe(false)
      expect(canActorTransition({ role, isOwner: false }, 'postponed', 'planning')).toBe(false)
    }
    expect(canActorTransition({ role: 'organiser', isOwner: true }, 'postponed', 'cancelled')).toBe(true)
    expect(canActorTransition({ role: 'organiser', isOwner: false }, 'postponed', 'cancelled')).toBe(false)
  })

  test('AC-038.2.5: the Coordinator is offered Postpone on a confirmed event and Resume on a postponed one', () => {
    expect(reviewActionsFor('confirmed').map((a) => a.label)).toContain('Postpone event')
    const resume = reviewActionsFor('postponed').find((a) => a.to === 'planning')
    expect(resume?.label).toBe('Resume planning')
  })
})

describe('AC-038.6 — completing an event only after it has ended', () => {
  const now = new Date('2046-06-01T10:00:00Z')

  test('AC-038.6.1: an event that has ended can be marked completed', () => {
    expect(hasEnded('2046-06-01T09:00:00Z', now)).toBe(true)
    expect(reviewActionsFor('confirmed', '2020-01-01T00:00:00Z').map((a) => a.to)).toContain('completed')
  })

  test('AC-038.6.2: an event still running or in the future cannot (boundary: ending exactly now counts as ended)', () => {
    expect(hasEnded('2046-06-01T10:00:01Z', now)).toBe(false)
    expect(hasEnded('2046-06-01T10:00:00Z', now)).toBe(true)
    expect(reviewActionsFor('confirmed', '2999-01-01T00:00:00Z').map((a) => a.to)).not.toContain('completed')
  })

  test('AC-038.6.3: with no end date, the button is withheld rather than guessed', () => {
    expect(hasEnded(null, now)).toBe(false)
    expect(hasEnded('not a date', now)).toBe(false)
    expect(reviewActionsFor('confirmed').map((a) => a.to)).not.toContain('completed')
  })
})

describe('AC-038.5 — leaving Confirmed', () => {
  test('AC-038.5.12: Confirmed can go back to Planning in the rules, but no actor can do it by hand', () => {
    expect(canTransition('confirmed', 'planning')).toBe(true)
    for (const role of ['coordinator', 'coordinator_lead', 'organiser'] as const) {
      expect(canActorTransition({ role, isOwner: true }, 'confirmed', 'planning')).toBe(false)
    }
    expect(reviewActionsFor('confirmed', '2020-01-01T00:00:00Z').map((a) => a.to)).not.toContain('planning')
  })
})
