import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { ReviewActions } from '../components/ReviewActions'
import { EventReadinessCard } from '../readiness/EventReadinessCard'
import { reviewActionsFor } from '../statusRules'

// The safety review is switched off: this is the app as everyone uses it until the team turns it on.
vi.mock('../../../lib/features', async (importOriginal) => ({
  FEATURES: { ...(await importOriginal<typeof import('../../../lib/features')>()).FEATURES, safetyReview: false },
}))
const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../readiness/readinessService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../readiness/readinessService')>()),
  getEventReadiness: mocks.load,
}))

describe('AC-043.1 — until the safety review is switched on, nothing changes', () => {
  test('AC-043.1.19: Planning still offers Confirm with today\'s hint, and the Readiness card offers no safety review', async () => {
    expect(reviewActionsFor('planning').map((action) => action.to)).toEqual(['confirmed', 'cancelled'])
    const { unmount } = render(<ReviewActions eventId="e-1" status="planning" onReviewed={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Confirm event' })).toBeInTheDocument()
    expect(screen.getByText(/Confirm only after you have checked/)).toBeInTheDocument()
    expect(screen.queryByText(/Readiness card/)).toBeNull()
    unmount()
    mocks.load.mockResolvedValue({ ok: true, lines: [{ arrangement: 'venue_booking', label: 'Venue booking', complete: true, detail: 'ok', sortOrder: 1 }] })
    render(<MemoryRouter><EventReadinessCard eventId="e-1" status="planning" onSent={() => undefined} /></MemoryRouter>)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('button', { name: 'Send for safety review' })).toBeNull()
    expect(screen.queryByText(/becomes available/)).toBeNull()
  })
})
