import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { SafetyReviewQueuePage } from '../SafetyReviewQueuePage'
import type { QueueEvent } from '../safetyReviewQueueService'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../safetyReviewQueueService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../safetyReviewQueueService')>()),
  getSafetyReviewQueue: mocks.load,
}))
vi.mock('../SafetyReviewDecisionForm', () => ({
  SafetyReviewDecisionForm: ({ eventId, onDecided }: { eventId: string; onDecided: (decision: string) => void }) => (
    <div>
      <button type="button" onClick={() => onDecided('approve')}>{`approve ${eventId}`}</button>
      <button type="button" onClick={() => onDecided('request_changes')}>{`changes ${eventId}`}</button>
      <button type="button" onClick={() => onDecided('reject')}>{`reject ${eventId}`}</button>
    </div>
  ),
}))

const event = (eventId: string, reference: string): QueueEvent => ({
  eventId, reference, name: 'Fixture', sentAt: null, proposedStart: null, proposedEnd: null,
  expectedAttendance: 10, accessibility: [], venues: [], equipment: [],
})

describe('AC-044.3 — a decided event leaves the queue', () => {
  test('AC-044.3.3: Review opens the decision form; once decided the event leaves the queue with a note of the outcome', async () => {
    mocks.load.mockResolvedValue({ ok: true, events: [event('e-1', 'EVT-1'), event('e-2', 'EVT-2'), event('e-3', 'EVT-3')] })
    render(<MemoryRouter><SafetyReviewQueuePage /></MemoryRouter>)
    await act(async () => { await Promise.resolve() })
    const reviews = screen.getAllByRole('button', { name: 'Review' })
    fireEvent.click(reviews[0])
    expect(screen.getByRole('button', { name: 'Close review' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'approve e-1' }))
    expect(screen.getByRole('status')).toHaveTextContent('EVT-1 · Fixture: approved; it is now In Preparation.')
    expect(screen.queryByText('EVT-1 · Fixture')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Review' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'changes e-2' }))
    expect(screen.getByRole('status')).toHaveTextContent('EVT-2 · Fixture: changes requested')
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close review' }))
    expect(screen.queryByRole('button', { name: 'reject e-3' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'reject e-3' }))
    expect(screen.getByRole('status')).toHaveTextContent('EVT-3 · Fixture: rejected')
    expect(screen.getByText('No events are awaiting safety review.')).toBeInTheDocument()
  })
})
