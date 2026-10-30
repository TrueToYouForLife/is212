import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ReviewActions } from '../components/ReviewActions'
import { readinessLink } from '../readiness/readinessLinks'
import { canActorTransition, reviewActionsFor } from '../statusRules'

// US45 tests run with the safety review switched on.
vi.mock('../../../lib/features', async (importOriginal) => ({
  FEATURES: { ...(await importOriginal<typeof import('../../../lib/features')>()).FEATURES, safetyReview: true },
}))
const mocks = vi.hoisted(() => ({ transition: vi.fn() }))
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  transitionEventStatus: mocks.transition,
}))

describe('AC-045.2 — the Coordinator revises a sent-back event in Planning', () => {
  test('AC-045.2.3: a sent-back event offers "Revise arrangements" (back to Planning) and cancelling, not resubmitting directly', () => {
    expect(reviewActionsFor('safety_changes_requested').map((action) => action.label)).toEqual(['Revise arrangements', 'Cancel event'])
    expect(reviewActionsFor('safety_changes_requested').map((action) => action.to)).toEqual(['planning', 'cancelled'])
  })

  test('AC-045.2.4: pressing "Revise arrangements" moves the event to Planning', async () => {
    mocks.transition.mockResolvedValue({ ok: true, status: 'planning' })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="e-1" status="safety_changes_requested" onReviewed={onReviewed} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Revise arrangements' })) })
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 'e-1', from: 'safety_changes_requested', to: 'planning' }))
    expect(onReviewed).toHaveBeenCalledWith('planning')
  })
})

describe('AC-045.4 — the readiness card points to what still needs review', () => {
  test('AC-045.4.2: the "Arrangements needing review" line links to the arrangement reviews on the page', () => {
    expect(readinessLink('arrangement_reviews', 'e-1')).toEqual({ kind: 'anchor', to: '#arrangement-reviews', text: 'Review the flagged arrangements' })
  })
})

describe('AC-045.6 — only a change sends an event back to Planning', () => {
  test('AC-045.6.4: nobody is offered a button to move an event in review or preparation back to Planning', () => {
    for (const from of ['awaiting_safety_review', 'in_preparation'] as const) {
      for (const role of ['coordinator', 'safety_officer', 'organiser'] as const) {
        expect(canActorTransition({ role, isOwner: true }, from, 'planning')).toBe(false)
      }
      expect(reviewActionsFor(from).map((action) => action.to)).not.toContain('planning')
    }
  })
})
