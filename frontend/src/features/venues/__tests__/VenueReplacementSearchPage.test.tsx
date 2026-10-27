import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueReplacementSearchPage } from '../pages/VenueReplacementSearchPage'
import { replacementFixture, replacementIds as ids } from './venueReplacementFixtures'
import { QUARTER_HOUR_SLOTS } from '../quarterHourSlots'

const mocks = vi.hoisted(() => ({ load: vi.fn(), search: vi.fn(), propose: vi.fn(), slots: vi.fn(), layouts: vi.fn(), role: 'coordinator' }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => ({ loading: false, profile: { id: 'coordinator', role: mocks.role } }) }))
vi.mock('../venueReplacementService', () => ({ getVenueReplacements: mocks.load, proposeVenueReplacement: mocks.propose }))
vi.mock('../venueSearchService', () => ({ searchVenues: mocks.search }))
vi.mock('../venueBookingService', () => ({ loadTimeSlots: mocks.slots }))
vi.mock('../suitabilityService', () => ({ loadLayoutTypes: mocks.layouts }))
const venue = { ...replacementFixture.venues[0], status: 'active', layout: 'theatre', accessibility: ['wheelchair_access'], facility: { wifi: true } }
const show = (id = ids.source) => render(<MemoryRouter initialEntries={[`/venues/bookings/${id}/replacement`]}>
  <Routes><Route path="/venues/bookings/:bookingId/replacement" element={<VenueReplacementSearchPage />} /></Routes>
</MemoryRouter>)
beforeEach(() => {
  vi.resetAllMocks(); mocks.role = 'coordinator'
  const value = structuredClone(replacementFixture); value.requests = []
  mocks.load.mockResolvedValue({ ok: true, value })
  mocks.search.mockResolvedValue({ ok: true, venues: [venue] })
  mocks.slots.mockResolvedValue(QUARTER_HOUR_SLOTS)
  mocks.layouts.mockResolvedValue([{ code: 'theatre', label: 'Theatre' }])
  mocks.propose.mockResolvedValue({ ok: true })
})

test('AC-048.2.1: affected booking prefills the full event interval, attendance, layout and requirements without editing the event', async () => {
  show()
  await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' })
  expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ eventId: ids.event, date: '', slot: '',
    minAttendance: '50', layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['wifi'] }), QUARTER_HOUR_SLOTS)
  expect(screen.getByText(/Event time \(Singapore\)/)).toHaveTextContent('09:00')
  expect(screen.getByText(/Event time \(Singapore\)/)).toHaveTextContent('11:00')
  expect(screen.getByLabelText('Expected attendance')).toHaveValue(50)
  expect(screen.getByLabelText('Layout')).toHaveValue('theatre')
  expect(screen.getByLabelText('Search for one of your events')).toBeDisabled()
  expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()
  expect(screen.getByText('Venue blocked: Ceiling unsafe')).toBeInTheDocument()
  expect(screen.getByText('Venue retired: Building closed')).toBeInTheDocument()
  expect(mocks.propose).not.toHaveBeenCalled()
})

test('AC-048.2.2: adjusted filters and reset keep the original event; a missing layout catalogue entry is retained', async () => {
  mocks.layouts.mockResolvedValue([])
  show()
  await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' })
  expect(screen.getByLabelText('Layout')).toHaveValue('theatre')
  await userEvent.clear(screen.getByLabelText('Expected attendance'))
  await userEvent.type(screen.getByLabelText('Expected attendance'), '40')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ eventId: ids.event, minAttendance: '40' }), QUARTER_HOUR_SLOTS))
  await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' })
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ eventId: ids.event, minAttendance: '50', layout: 'theatre' }), QUARTER_HOUR_SLOTS))
})

test('AC-048.2.3: empty, failed and unavailable-options searches never show stale selectable candidates', async () => {
  mocks.search.mockResolvedValueOnce({ ok: true, venues: [] }).mockResolvedValueOnce({ ok: false, reason: 'Availability unavailable' })
  const view = show()
  await screen.findByText(/No active venues match/)
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Availability unavailable')
  expect(screen.queryByRole('button', { name: /Choose .* as replacement/ })).not.toBeInTheDocument()
  view.unmount(); mocks.slots.mockResolvedValue([])
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Booking times could not be loaded')
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
})

test('AC-048.2.4: wrong role, invalid link and unavailable or pending originals cannot start a replacement search', async () => {
  mocks.role = 'organiser'
  let view = show()
  expect(screen.getByText(/Only Event Coordinators/)).toBeInTheDocument()
  expect(mocks.load).not.toHaveBeenCalled()
  view.unmount(); mocks.role = 'coordinator'; view = show('bad-id')
  expect(screen.getByRole('alert')).toHaveTextContent('booking link is invalid')
  expect(mocks.load).not.toHaveBeenCalled()
  view.unmount()
  const value = structuredClone(replacementFixture); value.sources = []
  mocks.load.mockResolvedValue({ ok: true, value }); view = show()
  expect(await screen.findByRole('alert')).toHaveTextContent('already pending')
  expect(mocks.search).not.toHaveBeenCalled()
  view.unmount(); value.requests = []; mocks.load.mockResolvedValue({ ok: true, value }); show()
  expect(await screen.findByRole('alert')).toHaveTextContent('not assigned to you')
  expect(mocks.search).not.toHaveBeenCalled()
})

test('AC-048.2.5: a late old search cannot overwrite a reloaded source and its new attendance requirements', async () => {
  let finish!: (value: unknown) => void
  mocks.search.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  show()
  await waitFor(() => expect(mocks.search).toHaveBeenCalledOnce())
  const value = structuredClone(replacementFixture); value.requests = []
  value.sources[0].version = 'source-v2'; value.sources[0].details.expectedAttendance = 70
  mocks.load.mockResolvedValue({ ok: true, value })
  await userEvent.click(screen.getByRole('button', { name: 'Reload booking and search' }))
  await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' })
  await act(async () => finish({ ok: true, venues: [{ ...venue, id: ids.replacement, name: 'Old result' }] }))
  expect(screen.queryByRole('button', { name: 'Choose Old result as replacement' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Expected attendance')).toHaveValue(70)
})

test('AC-048.3.8: selection submits the original booking and displayed consent once, requires a note, and preserves the original until approval', async () => {
  let finish!: (value: unknown) => void
  mocks.propose.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  show()
  await userEvent.click(await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' }))
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Provide a reason')
  expect(mocks.propose).not.toHaveBeenCalled()
  await userEvent.type(screen.getByLabelText('Reason and proposed arrangement'), 'Alternative arrangement')
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reload booking and search' })).toBeDisabled()
  expect(mocks.propose).toHaveBeenCalledOnce()
  expect(mocks.propose).toHaveBeenCalledWith(ids.source, ids.target, 'source-v1', 'Alternative arrangement')
  await act(async () => finish({ ok: true }))
  expect(screen.getByRole('status')).toHaveTextContent('original booking remains in place')
  expect(screen.getByRole('link', { name: /View bookings and replacement history/ })).toHaveAttribute('href', '/venues/bookings')
})

test('AC-048.3.9: failed submission keeps the note and source version, prevents retries, and needs an explicit reload', async () => {
  mocks.propose.mockResolvedValue({ ok: false, reason: 'Booking changed; reload' })
  show()
  await userEvent.click(await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' }))
  await userEvent.type(screen.getByLabelText('Reason and proposed arrangement'), 'Keep my note')
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Booking changed')
  expect(screen.getByLabelText('Reason and proposed arrangement')).toHaveValue('Keep my note')
  expect(screen.getByRole('button', { name: 'Propose replacement' })).toBeDisabled()
  expect(mocks.load).toHaveBeenCalledOnce()
  const value = structuredClone(replacementFixture); value.requests = []; value.sources[0].version = 'source-v2'
  mocks.load.mockResolvedValue({ ok: true, value })
  await userEvent.click(screen.getByRole('button', { name: 'Reload booking and search' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Choose Alternative Hall as replacement' }))
  await userEvent.type(screen.getByLabelText('Reason and proposed arrangement'), 'Fresh consent')
  mocks.propose.mockResolvedValue({ ok: true })
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(mocks.propose).toHaveBeenLastCalledWith(ids.source, ids.target, 'source-v2', 'Fresh consent')
})
