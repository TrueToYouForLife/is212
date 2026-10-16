import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { ReviewActions } from '../../components/ReviewActions'
import { RequestStatusPanel } from '../RequestStatusPanel'
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from '../../types'
import type { EventRequestDetail } from '../../types'

const lifecycle = vi.hoisted(() => ({ transition: vi.fn() }))
vi.mock('../../eventReviewService', () => ({ transitionEventStatus: lifecycle.transition }))
beforeEach(() => { lifecycle.transition.mockReset() })

const request: EventRequestDetail = {
  id: 'event-1', organiserId: 'owner-1', reference: null, name: null,
  purpose: null, eventType: null, proposedStart: null, proposedEnd: null,
  expectedAttendance: null, status: 'draft', submittedAt: null,
  description: null, programme: null, layoutPreference: null,
  accessibilityRequirements: null, equipmentRequirements: null,
  registrationRequired: false, specialArrangements: null,
  reviewNote: null, reviewedAt: null, createdAt: null,
}

describe('AC-003 — view event request status (SCRUM-24)', () => {
  // Iterates EVENT_STATUSES rather than a hardcoded list, so adding a status to the enum
  // without a label fails here instead of at runtime.
  test.each(EVENT_STATUSES)(
    'AC-003.3.1 (%s): clearly labels every status, including incomplete drafts',
    (status) => {
      render(<RequestStatusPanel organiserView request={{ ...request, status }} />)
      expect(screen.getByText(status === 'submitted' || status === 'under_review' ? 'In review' : EVENT_STATUS_LABELS[status])).toBeInTheDocument()
    },
  )

  test('AC-003.3.2: explains that approval is not confirmation', () => {
    const { rerender } = render(<RequestStatusPanel request={{ ...request, status: 'approved' }} />)
    expect(screen.getByText(/not yet confirmed/)).toBeInTheDocument()
    expect(screen.queryByText(/ready to proceed/)).not.toBeInTheDocument()
    rerender(<RequestStatusPanel request={{ ...request, status: 'confirmed' }} />)
    expect(screen.getByText(/ready to proceed/)).toBeInTheDocument()
    expect(screen.queryByText(/not yet confirmed/)).not.toBeInTheDocument()
  })

  test('AC-003.4.1: shows the rejection reason', () => {
    render(<RequestStatusPanel request={{ ...request, status: 'rejected', reviewNote: 'Venue unavailable' }} />)
    expect(screen.getByText('Reason for rejection')).toBeInTheDocument()
    expect(screen.getByText('Venue unavailable')).toBeInTheDocument()
  })

  test('AC-003.5.1: identifies an outstanding return and clears it after review progresses', () => {
    const { rerender } = render(<RequestStatusPanel organiserView request={{ ...request, status: 'submitted', reviewNote: 'Please amend the programme' }} />)
    expect(screen.getByText('Outstanding clarification or amendment request')).toBeInTheDocument()
    expect(screen.getByText('Please amend the programme')).toBeInTheDocument()
    expect(screen.getByText('Clarification required')).toBeInTheDocument()
    expect(screen.queryByText('In review')).not.toBeInTheDocument()
    expect(screen.getByText(/has been returned for clarification/)).toBeInTheDocument()
    expect(screen.queryByText(/is awaiting review/)).not.toBeInTheDocument()
    rerender(<RequestStatusPanel request={{ ...request, status: 'approved' }} />)
    expect(screen.queryByText('Outstanding clarification or amendment request')).not.toBeInTheDocument()
  })

  test('AC-003.4.2: missing legacy rejection reason has an explicit fallback', () => {
    render(<RequestStatusPanel request={{ ...request, status: 'rejected' }} />)
    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument()
  })
})

describe('coordinator lifecycle controls', () => {
  test.each([
    ['approved', 'Start planning', 'planning'],
    ['planning', 'Confirm event', 'confirmed'],
    ['confirmed', 'Mark completed', 'completed'],
  ] as const)('AC-LIFECYCLE.3-%s: invokes the guarded service and refreshes after success', async (status, label, to) => {
    lifecycle.transition.mockResolvedValue({ ok: true, status: to })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="event-1" status={status} onReviewed={onReviewed} />)
    await userEvent.click(screen.getByRole('button', { name: label }))
    expect(lifecycle.transition).toHaveBeenCalledWith({
      id: 'event-1', from: status, to, actor: { role: 'coordinator', isOwner: false }, note: '',
    })
    expect(onReviewed).toHaveBeenCalledWith(to)
  })

  test('AC-LIFECYCLE.4-01: cancellation requires confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    lifecycle.transition.mockResolvedValue({ ok: true, status: 'cancelled' })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="event-1" status="approved" onReviewed={onReviewed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel event' }))
    expect(lifecycle.transition).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel event' }))
    expect(onReviewed).toHaveBeenCalledWith('cancelled')
    confirm.mockRestore()
  })

  test('AC-LIFECYCLE.4-02: a failed update reports an error and allows retry', async () => {
    lifecycle.transition.mockRejectedValueOnce(new Error('network'))
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="event-1" status="approved" onReviewed={onReviewed} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start planning' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again')
    expect(onReviewed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Start planning' })).toBeEnabled()
  })
})