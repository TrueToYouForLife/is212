import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ReviewActions } from '../components/ReviewActions'

vi.mock('../eventReviewService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventReviewService')>()),
  transitionEventStatus: vi.fn(),
}))

describe('AC-004.1 — the coordinator sees what can still happen to a request', () => {
  test('AC-004.1.8: a completed request says it is final; a draft says no coordinator action applies yet', () => {
    const { unmount } = render(<ReviewActions eventId="e-1" status="completed" onReviewed={vi.fn()} />)
    expect(screen.getByText('This request is in a final state and cannot be changed.')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    unmount()
    render(<ReviewActions eventId="e-1" status="draft" onReviewed={vi.fn()} />)
    expect(screen.getByText('No coordinator actions are available at this stage.')).toBeInTheDocument()
  })
})
