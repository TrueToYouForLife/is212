import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ArrangementReviewPanel } from '../components/ArrangementReviewPanel'
const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../arrangementReviewService', () => ({ listArrangementReviews: mocks.read }))
const flag = { id: 'reason1', venue_booking_id: 'venue-booking-1', equipment_booking_id: null,
  detail: 'Attendance exceeds capacity.', created_at: '2026-10-13T01:00:00Z', venue_booking: { venue: { name: 'Hall A' } } }
beforeEach(() => vi.resetAllMocks())
test('AC-041.1.7: groups all reasons by arrangement, identifies venue and equipment and refreshes after review', async () => {
  mocks.read.mockResolvedValue({ ok: true, value: [flag, { ...flag, id: 'reason2', detail: 'Timing conflicts.' },
    { ...flag, id: 'reason3', venue_booking_id: null, equipment_booking_id: 'equipment-booking-1', venue_booking: null, detail: 'Equipment unavailable.' }] })
  const onCount = vi.fn()
  const { rerender } = render(<ArrangementReviewPanel eventId="event1" onCount={onCount} />)
  const venue = await screen.findByRole('article', { name: 'Venue booking — Hall A' })
  expect(within(venue).getByText('Attendance exceeds capacity.')).toBeInTheDocument()
  expect(within(venue).getByText('Timing conflicts.')).toBeInTheDocument()
  expect(within(venue).getByText('Reference: venue-booking-1')).toBeInTheDocument()
  expect(within(venue).getAllByText(/13 Oct 2026, 09:00/)).toHaveLength(2)
  expect(screen.getByRole('article', { name: 'Equipment reservation' })).toHaveTextContent('equipment-booking-1')
  expect(screen.getAllByText('Needs review')).toHaveLength(2)
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(2))
  expect(screen.queryByRole('button', { name: /resolve|clear/i })).not.toBeInTheDocument()
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  rerender(<ArrangementReviewPanel eventId="event1" refreshVersion={1} onCount={onCount} />)
  expect(await screen.findByText('No arrangements are currently flagged for review.')).toBeInTheDocument()
  expect(screen.queryByText('Attendance exceeds capacity.')).not.toBeInTheDocument()
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
})
test('AC-041.1.8: loading, failed read, retry and changed event do not show stale reasons or a false empty state', async () => {
  const user = userEvent.setup()
  let finish!: (value: unknown) => void
  mocks.read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { rerender } = render(<ArrangementReviewPanel eventId="event1" />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading arrangement reviews')
  finish({ ok: false, reason: 'Unable to load reviews' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load reviews')
  expect(screen.queryByText(/No arrangements/)).not.toBeInTheDocument()
  mocks.read.mockResolvedValue({ ok: true, value: [{ ...flag, venue_booking: null }] })
  await user.click(screen.getByRole('button', { name: 'Refresh arrangement reviews' }))
  expect(await screen.findByRole('article', { name: 'Venue booking' })).toHaveTextContent('venue-booking-1')
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  rerender(<ArrangementReviewPanel eventId="event2" />)
  expect(await screen.findByText(/No arrangements/)).toBeInTheDocument()
  expect(screen.queryByText(flag.detail)).not.toBeInTheDocument()
  expect(mocks.read).toHaveBeenLastCalledWith('event2')
})
