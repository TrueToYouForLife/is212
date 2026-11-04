import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ArrangementReviewPanel } from '../components/ArrangementReviewPanel'
import type { ArrangementReviewFlag } from '../arrangementReviewService'
const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../arrangementReviewService', () => ({ listArrangementReviews: mocks.read }))
const flag = { id: 'reason1', status: 'open', venue_booking_id: 'venue-booking-1', equipment_booking_id: null,
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
  expect(screen.getAllByRole('form', { name: 'Resolve review reason' })).toHaveLength(3)
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

test('AC-041.6.5: mixed resolution history is newest first, retains equipment/venue references and uses recorded actor IDs when display names are unavailable', async () => {
  const actorId = '41000000-0000-0000-0000-000000000099'
  const resolved: ArrangementReviewFlag = {
    ...flag, id: '41000000-0000-0000-0000-000000000001', status: 'resolved',
    venue_booking_id: '41000000-0000-0000-0000-000000000011',
    resolution: 'Venue reviewed and corrected.', resolution_method: 'corrected',
    resolved_at: '2026-10-13T02:00:00Z', resolved_by: actorId, resolver: { full_name: 'Jaydon' },
  }
  const unnamedVenue: ArrangementReviewFlag = {
    ...resolved, id: '41000000-0000-0000-0000-000000000002',
    venue_booking_id: '41000000-0000-0000-0000-000000000012', venue_booking: { venue: null },
    detail: 'Venue requirements checked.', resolution: 'Saved booking remains suitable.',
    resolution_method: 'confirmed_valid', resolved_at: '2026-10-13T03:00:00Z', resolver: { full_name: '' },
  }
  const equipment: ArrangementReviewFlag = {
    ...resolved, id: '41000000-0000-0000-0000-000000000003', venue_booking_id: null,
    equipment_booking_id: '41000000-0000-0000-0000-000000000013', venue_booking: null,
    detail: 'Equipment window checked.', resolution: 'Reserved equipment still covers the event.',
    resolution_method: 'confirmed_valid', resolved_at: '2026-10-13T04:00:00Z', resolver: null,
  }
  mocks.read.mockResolvedValue({ ok: true, value: [resolved, equipment, unnamedVenue] })
  const onCount = vi.fn()
  render(<ArrangementReviewPanel eventId="event1" onCount={onCount} />)
  const history = await screen.findByRole('region', { name: 'Resolution history' })
  const items = within(history).getAllByRole('listitem')
  expect(items.map(item => within(item).getByText(/Reference:/).textContent)).toEqual([
    `Reference: ${equipment.equipment_booking_id}`, `Reference: ${unnamedVenue.venue_booking_id}`,
    `Reference: ${resolved.venue_booking_id}`,
  ])
  expect(items[0]).toHaveTextContent(`Equipment reservation — ${equipment.equipment_booking_id}`)
  expect(items[0]).toHaveTextContent('Resolved — Still valid')
  expect(items[0]).toHaveTextContent(`Recorded by ${actorId} · 13 Oct 2026, 12:00`)
  expect(items[1]).toHaveTextContent(`Venue booking — ${unnamedVenue.venue_booking_id}`)
  expect(items[1]).toHaveTextContent(`Recorded by ${actorId} · 13 Oct 2026, 11:00`)
  expect(items[2]).toHaveTextContent('Venue booking — Hall A')
  expect(items[2]).toHaveTextContent('Resolved — Arrangement corrected')
  expect(items[2]).toHaveTextContent('Recorded by Jaydon · 13 Oct 2026, 10:00')
  for (const record of [resolved, unnamedVenue, equipment]) {
    expect(within(history).getByText(record.detail)).toBeInTheDocument()
    expect(within(history).getByText(record.resolution!)).toBeInTheDocument()
  }
  expect(within(history).queryByRole('form')).not.toBeInTheDocument()
  expect(screen.queryByText('Needs review')).not.toBeInTheDocument()
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
})

test('AC-041.1.17: a late previous-event response cannot replace the current reasons or their arrangement count', async () => {
  let finish!: (value: unknown) => void
  mocks.read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const onCount = vi.fn()
  const view = render(<ArrangementReviewPanel eventId="old-event" onCount={onCount} />)
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(null))
  const current = { ...flag, id: 'current-reason', detail: 'Current equipment reason',
    venue_booking_id: null, equipment_booking_id: 'current-equipment', venue_booking: null }
  mocks.read.mockResolvedValue({ ok: true, value: [current] })
  view.rerender(<ArrangementReviewPanel eventId="current-event" onCount={onCount} />)
  expect(await screen.findByText('Current equipment reason')).toBeInTheDocument()
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
  const calls = onCount.mock.calls.length
  await act(async () => { finish({ ok: true, value: [flag, { ...flag, venue_booking_id: 'second-booking' }] }) })
  expect(screen.getByText('Current equipment reason')).toBeInTheDocument()
  expect(screen.queryByText(flag.detail)).not.toBeInTheDocument()
  expect(screen.getAllByText('Needs review')).toHaveLength(1)
  expect(onCount).toHaveBeenCalledTimes(calls)
  expect(mocks.read.mock.calls).toEqual([['old-event'], ['current-event']])
})
