import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { OrganiserVenueArrangements } from '../components/OrganiserVenueArrangements'
import { VENUE_ARRANGEMENTS_ERROR } from '../organiserVenueArrangementService'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../organiserVenueArrangementService', async importOriginal => ({
  ...await importOriginal<typeof import('../organiserVenueArrangementService')>(),
  loadOrganiserVenueArrangements: mocks.read,
}))
const eventId = '42100000-0000-0000-0000-000000000001'
const bookings = [
  { booking_id: 'booking1', venue_name: 'Main Hall', slots: [
    { date: '2042-02-10', slot: 'NIGHT', startsAt: '19:00:00', endsAt: '24:00:00', kind: 'event' },
    { date: '2042-02-11', slot: 'AM', startsAt: '07:00:00', endsAt: '12:00:00', kind: 'buffer' },
  ] },
  { booking_id: 'booking2', venue_name: 'Annex', slots: [] },
]
beforeEach(() => vi.resetAllMocks())

test('AC-042.1.5: organiser sees each venue with Singapore booking dates, midnight and buffer labels; missing slots stay explicit', async () => {
  mocks.read.mockResolvedValue({ ok: true, value: bookings })
  render(<OrganiserVenueArrangements eventId={eventId} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading venue arrangements')
  const hall = await screen.findByRole('article', { name: 'Main Hall' })
  const slots = within(hall).getAllByRole('listitem')
  expect(slots[0]).toHaveTextContent('10 Feb 2042 · NIGHT · 19:00–24:00 (midnight at end of day) · Event')
  expect(slots[1]).toHaveTextContent('11 Feb 2042 · AM · 07:00–12:00 · Setup / turnaround')
  expect(screen.getByRole('article', { name: 'Annex' })).toHaveTextContent('Booked slot details are unavailable')
  expect(mocks.read).toHaveBeenCalledWith(eventId)
})

test('AC-042.1.6: refresh replaces bookings, failed reads never show an empty success, and retry and event changes recover', async () => {
  mocks.read.mockResolvedValue({ ok: true, value: bookings })
  const { rerender } = render(<OrganiserVenueArrangements eventId={eventId} />)
  await screen.findByRole('article', { name: 'Main Hall' })
  mocks.read.mockResolvedValue({ ok: false, reason: VENUE_ARRANGEMENTS_ERROR })
  await userEvent.click(screen.getByRole('button', { name: 'Refresh venue arrangements' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(VENUE_ARRANGEMENTS_ERROR)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.queryByText('No venue bookings have been approved yet.')).not.toBeInTheDocument()
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('No venue bookings have been approved yet.')
  mocks.read.mockResolvedValue({ ok: true, value: [bookings[1]] })
  fireEvent.focus(window)
  await screen.findByRole('article', { name: 'Annex' })
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  rerender(<OrganiserVenueArrangements eventId={eventId} refreshVersion={1} />)
  await screen.findByText('No venue bookings have been approved yet.')
  const nextId = '42100000-0000-0000-0000-000000000002'
  rerender(<OrganiserVenueArrangements eventId={nextId} />)
  await waitFor(() => expect(mocks.read).toHaveBeenLastCalledWith(nextId))
  await screen.findByText('No venue bookings have been approved yet.')
})
