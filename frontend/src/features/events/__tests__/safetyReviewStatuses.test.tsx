import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { USER_ROLE_LABELS, isUserRole } from '../../auth/types'
import { ReviewActions } from '../components/ReviewActions'
import { StatusBadge } from '../components/StatusBadge'
import { RequestStatusPanel } from '../status/RequestStatusPanel'
import { STATUS_TRANSITIONS, canActorTransition, reviewActionsFor } from '../statusRules'
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from '../types'
import type { EventRequestDetail } from '../types'

const COORDINATOR = { role: 'coordinator', isOwner: false } as const
const SAFETY_OFFICER = { role: 'safety_officer', isOwner: false } as const

describe('AC-043.1 — the Coordinator sends an event for review once its arrangements are complete', () => {
  test('AC-043.1.9: the rules mirror 0108: Planning leads only to safety review, and Confirmed only follows In Preparation', () => {
    expect(STATUS_TRANSITIONS.planning).toEqual(['awaiting_safety_review', 'cancelled'])
    expect(STATUS_TRANSITIONS.awaiting_safety_review).toEqual(['in_preparation', 'safety_changes_requested', 'cancelled'])
    expect(STATUS_TRANSITIONS.safety_changes_requested).toEqual(['awaiting_safety_review', 'cancelled'])
    expect(STATUS_TRANSITIONS.in_preparation).toEqual(['confirmed', 'cancelled'])
    expect(EVENT_STATUSES.filter((status) => STATUS_TRANSITIONS[status].includes('confirmed'))).toEqual(['in_preparation'])
  })

  test('AC-043.1.10: no status button sends an event for review; that is done from its Readiness card', () => {
    for (const role of ['coordinator', 'coordinator_lead', 'safety_officer', 'organiser'] as const) {
      expect(canActorTransition({ role, isOwner: true }, 'planning', 'awaiting_safety_review')).toBe(false)
    }
    expect(reviewActionsFor('planning').map((action) => action.label)).toEqual(['Cancel event'])
  })
})

describe('AC-043.2 — the event shows as Awaiting Safety Review', () => {
  test('AC-043.2.5: every safety stage has a label and a badge', () => {
    for (const status of ['awaiting_safety_review', 'safety_changes_requested', 'in_preparation'] as const) {
      const { unmount } = render(<StatusBadge status={status} />)
      expect(screen.getByText(EVENT_STATUS_LABELS[status])).toBeInTheDocument()
      unmount()
    }
    expect(EVENT_STATUS_LABELS.awaiting_safety_review).toBe('Awaiting safety review')
    expect(EVENT_STATUS_LABELS.safety_changes_requested).toBe('Safety changes requested')
    expect(EVENT_STATUS_LABELS.in_preparation).toBe('In preparation')
  })

  test('AC-043.2.6: the Organiser is told their event is with the Safety Officer and not yet confirmed', () => {
    const request = { id: 'e-1', status: 'awaiting_safety_review', reviewNote: null } as unknown as EventRequestDetail
    render(<RequestStatusPanel request={request} organiserView />)
    expect(screen.getByText(/with the Safety Officer for an operational safety check; the event is not yet confirmed/)).toBeInTheDocument()
  })

  test('AC-043.2.7: Safety Officer is a role the app recognises and names', () => {
    expect(isUserRole('safety_officer')).toBe(true)
    expect(USER_ROLE_LABELS.safety_officer).toBe('Safety Officer')
  })
})

describe('AC-043.3 — while awaiting review the event cannot move to In Preparation or Confirmed', () => {
  test('AC-043.3.6: a Coordinator awaiting review can only cancel; deciding the review is the Safety Officer\'s', () => {
    expect(reviewActionsFor('awaiting_safety_review').map((action) => action.to)).toEqual(['cancelled'])
    expect(canActorTransition(COORDINATOR, 'awaiting_safety_review', 'in_preparation')).toBe(false)
    expect(canActorTransition(COORDINATOR, 'awaiting_safety_review', 'safety_changes_requested')).toBe(false)
    expect(canActorTransition(COORDINATOR, 'awaiting_safety_review', 'confirmed')).toBe(false)
    expect(canActorTransition(SAFETY_OFFICER, 'awaiting_safety_review', 'in_preparation')).toBe(true)
    expect(canActorTransition(SAFETY_OFFICER, 'awaiting_safety_review', 'safety_changes_requested')).toBe(true)
  })
})

describe('AC-043.1 — the Coordinator is pointed to the Readiness card', () => {
  test('AC-043.1.15: in Planning the hint points to the Readiness card and there is no Confirm; once In Preparation, Confirm is back with its check', () => {
    const { unmount } = render(<ReviewActions eventId="e-1" status="planning" onReviewed={() => undefined} />)
    expect(screen.getByText(/from its Readiness card once every arrangement is complete/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm event' })).toBeNull()
    unmount()
    render(<ReviewActions eventId="e-1" status="in_preparation" onReviewed={() => undefined} />)
    expect(screen.getByText(/Confirm only after you have checked/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm event' })).toBeInTheDocument()
  })
})

