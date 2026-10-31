import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { CANCEL_CONFIRMATION, ReviewActions } from '../components/ReviewActions'

const mocks = vi.hoisted(() => ({ transition: vi.fn() }))
vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  transitionEventStatus: mocks.transition,
}))

afterEach(() => vi.restoreAllMocks())

describe('AC-021.1 — cancelling an event', () => {
  test('AC-021.1.6: the Coordinator is told cancelling releases the bookings and reservations and tells attendees; declining changes nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mocks.transition.mockResolvedValue({ ok: true, status: 'cancelled' })
    const onReviewed = vi.fn()
    render(<ReviewActions eventId="e-1" status="confirmed" onReviewed={onReviewed} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel event' })) })
    expect(confirm).toHaveBeenCalledWith(CANCEL_CONFIRMATION)
    expect(CANCEL_CONFIRMATION).toMatch(/venue bookings and equipment reservations will be released/)
    expect(CANCEL_CONFIRMATION).toMatch(/registered attendees will be told/)
    expect(mocks.transition).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel event' })) })
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ id: 'e-1', from: 'confirmed', to: 'cancelled' }))
    expect(onReviewed).toHaveBeenCalledWith('cancelled')
  })
})
