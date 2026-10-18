import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueSuitabilityPage } from '../pages/VenueSuitabilityPage'

const mocks = vi.hoisted(() => ({
  role: 'coordinator',
  load: vi.fn(),
  assess: vi.fn(),
  save: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'coordinator-1', role: mocks.role } }),
}))
vi.mock('../venueSearchService', () => ({
  listMyAssignedEvents: async () => [{
    id: 'event-1', reference: 'EVT-1', name: 'Workshop', proposedStart: null, proposedEnd: null,
    expectedAttendance: 60, layoutPreference: 'theatre',
    accessibilityRequirements: ['wheelchair_access'], facilityRequirements: ['projector'],
    equipmentRequirements: [],
  }],
}))
vi.mock('../venueBookingService', () => ({ loadTimeSlots: async () => [] }))
vi.mock('../suitabilityService', () => ({
  loadLayoutTypes: async () => [{ code: 'theatre', label: 'Theatre' }],
  loadEventSuitability: mocks.load,
  assessVenuesForEvent: mocks.assess,
  saveVenueRequirements: mocks.save,
}))

const EVENT = {
  id: 'event-1', reference: 'EVT-1', name: 'Workshop', proposedStart: null, proposedEnd: null,
  expectedAttendance: 60, layoutPreference: 'theatre',
  accessibilityRequirements: ['wheelchair_access'], facilityRequirements: ['projector'],
}
const HALL = {
  venue: {
    id: 'v-hall', name: 'Main Hall', location: 'Level 2', status: 'active',
    layouts: [{ layout: 'theatre', capacity: 200 }], accessibility: [], facility: {},
  },
  verdict: 'suitable',
  reasons: [],
  fittingLayouts: [{ layout: 'theatre', capacity: 200 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'coordinator'
  mocks.load.mockResolvedValue({ ok: true, value: { event: EVENT, requirements: { layout: null, accessibility: [], facilities: [] } } })
  mocks.assess.mockResolvedValue({ ok: true, value: [HALL] })
  mocks.save.mockResolvedValue({ ok: true, value: { layout: 'theatre', accessibility: [], facilities: [] } })
})

async function chooseEvent() {
  render(<VenueSuitabilityPage />)
  await screen.findByRole('option', { name: 'EVT-1 — Workshop' })
  fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'event-1' } })
}

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test('AC-018.1.28: only Event Coordinators can use the suitability page', () => {
    mocks.role = 'organiser'
    render(<VenueSuitabilityPage />)
    expect(screen.getByText('Venue suitability is available to Event Coordinators.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Event')).not.toBeInTheDocument()
  })

  test("AC-018.1.29: choosing an event shows the organiser's own requirements and every venue assessed", async () => {
    await chooseEvent()
    expect(await screen.findByText('Main Hall')).toBeInTheDocument()
    // Codes since 0054, so the page shows catalogue labels instead of free text. Read
    // from the description list: "Theatre" is also an option in the requirements form's
    // layout dropdown, and "Projector" one of its facility checkboxes.
    const organiserValue = (label: string) =>
      screen.getByText(label).nextElementSibling?.textContent
    expect(organiserValue("Organiser's layout request")).toBe('Theatre')
    expect(organiserValue("Organiser's accessibility needs")).toBe('Wheelchair access')
    expect(organiserValue("Organiser's facility needs")).toBe('Projector')
    expect(mocks.assess).toHaveBeenCalledWith('event-1', [])
  })

  test('AC-018.1.30: saving requirements stores them and checks the venues again', async () => {
    await chooseEvent()
    await screen.findByText('Main Hall')
    fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'theatre' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save requirements' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('event-1', {
      layout: 'theatre', accessibility: [], facilities: [],
    }))
    await waitFor(() => expect(mocks.assess).toHaveBeenCalledTimes(2))
  })
})

describe('AC-018.4 — venues taken by bookings or maintenance are blacked out', () => {
  test('AC-018.4.13: when availability cannot be checked, the reason is shown and no venue is offered', async () => {
    mocks.assess.mockResolvedValue({ ok: false, reason: 'Venue availability could not be checked. Please try again.' })
    await chooseEvent()
    expect(await screen.findByRole('alert')).toHaveTextContent('Venue availability could not be checked.')
    expect(screen.queryByText('Main Hall')).not.toBeInTheDocument()
  })
})