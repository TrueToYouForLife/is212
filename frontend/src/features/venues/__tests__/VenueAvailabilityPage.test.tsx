import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueAvailabilityPage } from '../pages/VenueAvailabilityPage'
import { buildVenueAvailability } from '../venueAvailability'
import type { VenueAvailability } from '../venueAvailability'
import { SLOTS } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({
  role: 'venue_staff' as string,
  userLoading: false,
  flags: { venueBooking: true },
  getAvailability: vi.fn(),
  loadSlots: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: { id: 'user-1', role: mocks.role } }),
}))
vi.mock('../../../lib/features', () => ({ FEATURES: mocks.flags }))
vi.mock('../venueAvailabilityService', () => ({ getVenueAvailability: mocks.getAvailability }))
vi.mock('../venueBookingService', () => ({ loadTimeSlots: mocks.loadSlots }))

function weekFrom(fromDate: string): VenueAvailability {
  return buildVenueAvailability(
    [{ id: 'v-hall', name: 'Alpha Hall', location: 'Level 1', status: 'active' }], SLOTS, [], fromDate, 7,
  )
}

function renderPage() {
  render(
    <MemoryRouter>
      <VenueAvailabilityPage />
    </MemoryRouter>,
  )
}

/** The fromDate of each call to getVenueAvailability, in order. */
const requestedWeeks = () => mocks.getAvailability.mock.calls.map((call) => call[1])

beforeEach(() => {
  vi.clearAllMocks()
  // 16:30 UTC on 11 Oct is already 12 Oct in Singapore.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T16:30:00Z'))
  mocks.role = 'venue_staff'
  mocks.userLoading = false
  mocks.flags.venueBooking = true
  mocks.loadSlots.mockResolvedValue(SLOTS)
  mocks.getAvailability.mockImplementation(async (_slots: unknown, fromDate: string) => (
    { ok: true, availability: weekFrom(fromDate) }
  ))
})
afterEach(() => vi.useRealTimers())

describe('AC-019.1 — staff can view availability across dates', () => {
  test('AC-019.1.14: Venue Staff see every venue for the week starting today in Singapore', async () => {
    renderPage()
    expect(screen.getByText('Loading availability…')).toBeInTheDocument()

    expect(await screen.findByText('Alpha Hall')).toBeInTheDocument()
    expect(mocks.getAvailability).toHaveBeenCalledWith(SLOTS, '2026-10-12', 7)
    expect(screen.getByLabelText('Week beginning')).toHaveValue('2026-10-12')
    expect(screen.getByRole('list', { name: 'Key' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alpha Hall' })).toBeNull()
  })

  test('AC-019.1.15: coordinators see it too, and can open a venue\'s timetable from its name', async () => {
    mocks.role = 'coordinator'
    renderPage()
    expect(await screen.findByRole('link', { name: 'Alpha Hall' })).toHaveAttribute('href', '/venues/v-hall/timetable')
  })

  test('AC-019.1.16: while venue booking is switched off, coordinators get no link to a timetable that is not there', async () => {
    mocks.role = 'coordinator'
    mocks.flags.venueBooking = false
    renderPage()
    expect(await screen.findByText('Alpha Hall')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alpha Hall' })).toBeNull()
  })

  test.each(['organiser', 'coordinator_lead', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-019.1.17: a %s is told the calendar is not for their role, and nothing is loaded',
    (role) => {
      mocks.role = role
      renderPage()
      expect(screen.getByText('Venue availability is available to Venue Staff and Event Coordinators.')).toBeInTheDocument()
      expect(screen.queryByLabelText('Week beginning')).toBeNull()
      expect(mocks.loadSlots).not.toHaveBeenCalled()
      expect(mocks.getAvailability).not.toHaveBeenCalled()
    },
  )

  test('AC-019.1.18: while the session is still loading, nothing is shown or loaded yet', () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.getAvailability).not.toHaveBeenCalled()
  })

  test('AC-019.1.19: next, previous and this week move the calendar a week at a time', async () => {
    renderPage()
    await screen.findByText('Alpha Hall')

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(requestedWeeks().at(-1)).toBe('2026-10-19'))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    await waitFor(() => expect(requestedWeeks().at(-1)).toBe('2026-10-05'))
    fireEvent.click(screen.getByRole('button', { name: 'This week' }))
    await waitFor(() => expect(requestedWeeks().at(-1)).toBe('2026-10-12'))
    expect(screen.getByLabelText('Week beginning')).toHaveValue('2026-10-12')
  })

  test('AC-019.1.20: choosing a date starts the week there; clearing the date keeps the current week', async () => {
    renderPage()
    await screen.findByText('Alpha Hall')

    fireEvent.change(screen.getByLabelText('Week beginning'), { target: { value: '2026-12-29' } })
    await waitFor(() => expect(requestedWeeks().at(-1)).toBe('2026-12-29'))
    const calls = mocks.getAvailability.mock.calls.length
    fireEvent.change(screen.getByLabelText('Week beginning'), { target: { value: '' } })
    expect(mocks.getAvailability.mock.calls.length).toBe(calls)
    expect(screen.getByLabelText('Week beginning')).toHaveValue('2026-12-29')
  })

  test('AC-019.1.21: slot times are read once and reused when moving between weeks', async () => {
    renderPage()
    await screen.findByText('Alpha Hall')
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalledTimes(2))
    expect(mocks.loadSlots).toHaveBeenCalledTimes(1)
  })

  test('AC-019.1.22: a failed load shows the error instead of a calendar, and slot times are retried next time', async () => {
    mocks.loadSlots.mockResolvedValueOnce([])
    mocks.getAvailability.mockResolvedValueOnce({ ok: false, reason: 'Venue availability could not be loaded. Please try again.' })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Venue availability could not be loaded.')
    expect(screen.queryByText('Alpha Hall')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('Alpha Hall')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.loadSlots).toHaveBeenCalledTimes(2)
  })

  test('AC-019.1.23: with no active venues, the page says so rather than showing an empty grid', async () => {
    mocks.getAvailability.mockResolvedValue({ ok: true, availability: { fromDate: '2026-10-12', dates: [], rows: [] } })
    renderPage()
    expect(await screen.findByText('No venues to show')).toBeInTheDocument()
  })

  test('AC-019.1.24: an answer for a week the user has already moved away from is ignored', async () => {
    let finishFirst: (value: unknown) => void = () => undefined
    mocks.getAvailability.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve }))
    renderPage()
    await waitFor(() => expect(mocks.getAvailability).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(requestedWeeks().at(-1)).toBe('2026-10-19'))
    await screen.findByText('Mon')
    finishFirst({ ok: false, reason: 'stale answer' })

    await waitFor(() => expect(screen.queryByText('stale answer')).toBeNull())
    expect(screen.getByText('19 Oct')).toBeInTheDocument()
  })
})
