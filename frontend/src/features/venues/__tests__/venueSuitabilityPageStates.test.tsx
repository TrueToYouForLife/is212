import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueSuitabilityPage } from '../pages/VenueSuitabilityPage'
import type { SuitabilityEvent } from '../suitabilityTypes'

const mocks = vi.hoisted(() => ({
  user: { loading: false, profile: { id: 'coord-1', role: 'coordinator' } as null | { id: string; role: string } },
  listMyAssignedEvents: vi.fn(), loadLayoutTypes: vi.fn(), loadTimeSlots: vi.fn(),
  loadEventSuitability: vi.fn(), assessVenuesForEvent: vi.fn(), saveVenueRequirements: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => mocks.user }))
vi.mock('../venueSearchService', () => ({ listMyAssignedEvents: mocks.listMyAssignedEvents }))
vi.mock('../venueBookingService', () => ({ loadTimeSlots: mocks.loadTimeSlots }))
vi.mock('../suitabilityService', () => ({
  loadLayoutTypes: mocks.loadLayoutTypes, loadEventSuitability: mocks.loadEventSuitability,
  assessVenuesForEvent: mocks.assessVenuesForEvent, saveVenueRequirements: mocks.saveVenueRequirements,
}))
// The form and the result list have their own tests; here the form only exposes its save
// so the page's handling of the answer can be checked.
vi.mock('../components/VenueRequirementsForm', () => ({
  VenueRequirementsForm: ({ onSave }: { onSave: (value: unknown) => Promise<string | null> }) => {
    const [message, setMessage] = useState('')
    return <div><button type="button" onClick={async () => setMessage((await onSave({})) ?? 'saved')}>Save requirements</button><p>{message}</p></div>
  },
}))
vi.mock('../components/SuitabilityResultList', () => ({
  SuitabilityResultList: ({ layoutLabel }: { layoutLabel: (code: string) => string }) => <p>{`results, layout ${layoutLabel('theatre')}`}</p>,
}))

const EVENT: SuitabilityEvent = {
  id: 'evt-1', reference: 'EVT-1', name: 'Gala', proposedStart: '2035-03-10T01:00:00Z', proposedEnd: '2035-03-10T09:00:00Z',
  expectedAttendance: 80, layoutPreference: 'theatre', accessibilityRequirements: ['wheelchair_access'], facilityRequirements: [],
}

async function chooseEvent(id = 'evt-1') {
  await screen.findByRole('option', { name: /Gala|Untitled event/ })
  await act(async () => { fireEvent.change(screen.getByLabelText('Event'), { target: { value: id } }) })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.loading = false
  mocks.user.profile = { id: 'coord-1', role: 'coordinator' }
  mocks.listMyAssignedEvents.mockResolvedValue([{ id: 'evt-1', reference: 'EVT-1', name: 'Gala' }])
  mocks.loadLayoutTypes.mockResolvedValue([{ code: 'theatre', label: 'Theatre' }])
  mocks.loadTimeSlots.mockResolvedValue([])
  mocks.loadEventSuitability.mockResolvedValue({ ok: true, value: { event: EVENT, requirements: {} } })
  mocks.assessVenuesForEvent.mockResolvedValue({ ok: true, value: [] })
  mocks.saveVenueRequirements.mockResolvedValue({ ok: true })
})

describe('AC-018.1 — the suitability page in its less common states', () => {
  test('AC-018.1.36: while the session is checked the page shows nothing and loads nothing', () => {
    mocks.user.loading = true
    mocks.user.profile = null
    const { container } = render(<VenueSuitabilityPage />)
    expect(container).toBeEmptyDOMElement()
    expect(mocks.listMyAssignedEvents).not.toHaveBeenCalled()
  })

  test('AC-018.1.37: events are listed by reference and name, falling back to "Untitled event"', async () => {
    mocks.listMyAssignedEvents.mockResolvedValue([{ id: 'evt-1', reference: 'EVT-1', name: 'Gala' }, { id: 'evt-2', reference: null, name: null }])
    render(<VenueSuitabilityPage />)
    expect(await screen.findByRole('option', { name: 'EVT-1 — Gala' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Untitled event' })).toBeInTheDocument()
  })

  test('AC-018.1.38: an event that cannot be loaded shows why, with no requirements or venues', async () => {
    mocks.loadEventSuitability.mockResolvedValue({ ok: false, reason: 'That event could not be loaded.' })
    render(<VenueSuitabilityPage />)
    await chooseEvent()
    expect(await screen.findByRole('alert')).toHaveTextContent('That event could not be loaded.')
    expect(screen.queryByText('Requirements')).toBeNull()
  })

  test('AC-018.1.39: an event with no attendance, layout or needs reads "Not given" and "None"; unknown codes show as given', async () => {
    mocks.loadEventSuitability.mockResolvedValue({ ok: true, value: { event: {
      ...EVENT, expectedAttendance: null, layoutPreference: null, accessibilityRequirements: [], facilityRequirements: ['laser_show'],
    }, requirements: {} } })
    render(<VenueSuitabilityPage />)
    await chooseEvent()
    expect(await screen.findByText('Not given')).toBeInTheDocument()
    expect(screen.getAllByText('None')).toHaveLength(2)
    expect(screen.getByText('laser_show')).toBeInTheDocument()
  })

  test('AC-018.1.40: a layout code missing from the catalogue is shown as its code', async () => {
    mocks.loadLayoutTypes.mockResolvedValue([])
    render(<VenueSuitabilityPage />)
    await chooseEvent()
    expect(await screen.findByText('results, layout theatre')).toBeInTheDocument()
    expect(screen.getAllByText('theatre').length).toBeGreaterThan(0)
  })
})

describe('AC-018.2 — saving the requirements', () => {
  test('AC-018.2.7: a refused save shows its reason and does not reload; a successful one reloads the venues', async () => {
    render(<VenueSuitabilityPage />)
    await chooseEvent()
    await screen.findByText('results, layout Theatre')
    mocks.loadEventSuitability.mockClear()
    mocks.saveVenueRequirements.mockResolvedValueOnce({ ok: false, reason: 'Attendance must be a whole number.' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save requirements' })) })
    expect(await screen.findByText('Attendance must be a whole number.')).toBeInTheDocument()
    expect(mocks.loadEventSuitability).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save requirements' })) })
    expect(await screen.findByText('saved')).toBeInTheDocument()
    expect(mocks.loadEventSuitability).toHaveBeenCalledWith('evt-1')
  })
})
