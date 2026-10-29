import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReviewActions } from '../components/ReviewActions'
import { StatusBadge } from '../components/StatusBadge'
import { REVIEW_MESSAGES } from '../eventReviewService'
import { RequestStatusPanel } from '../status/RequestStatusPanel'
import type { EventRequestDetail } from '../types'

const mocks = vi.hoisted(() => ({ transition: vi.fn() }))
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  transitionEventStatus: mocks.transition,
}))

const REQUEST: EventRequestDetail = {
  id: 'event-1', organiserId: 'owner-1', reference: 'EVT-1', name: 'Conference',
  purpose: null, eventType: null, proposedStart: null, proposedEnd: null,
  expectedAttendance: null, status: 'confirmed', submittedAt: null,
  description: null, programme: null, layoutPreference: null,
  accessibilityRequirements: [], facilityRequirements: [], equipmentRequirements: [],
  registrationRequired: false, specialArrangements: null,
  reviewNote: null, reviewedAt: null, createdAt: null,
}

beforeEach(() => mocks.transition.mockReset())

describe('AC-026.1 — confirmed only once every essential arrangement is complete', () => {
  test('AC-026.1.6: pressing Confirm on an event that is not ready says why, and nothing changes', async () => {
    mocks.transition.mockResolvedValue({ ok: false, reason: REVIEW_MESSAGES.notReady })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="event-1" status="planning" onReviewed={onReviewed} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm event' })) })
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1', from: 'planning', to: 'confirmed' }))
    expect(screen.getByText(REVIEW_MESSAGES.notReady)).toBeInTheDocument()
    expect(onReviewed).not.toHaveBeenCalled()
  })
})

describe('AC-026.2 — a confirmed event shows as Confirmed', () => {
  test('AC-026.2.2: the badge reads Confirmed, and the Organiser is told the event will go ahead', () => {
    const { unmount } = render(<StatusBadge status="confirmed" />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    unmount()
    render(<RequestStatusPanel organiserView request={REQUEST} />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Your event has been confirmed and is ready to proceed.')).toBeInTheDocument()
  })
})
