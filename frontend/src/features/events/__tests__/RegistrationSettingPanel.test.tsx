import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RegistrationSettingPanel } from '../components/RegistrationSettingPanel'
import { RequestDetails } from '../components/RequestDetails'
import type { EventRequestDetail } from '../types'

/** US52 (SCRUM-245): the coordinator's switch and what the organiser reads. */
const mocks = vi.hoisted(() => ({ set: vi.fn() }))
vi.mock('../registrationSettingService', () => ({ setEventRegistration: mocks.set }))

const eventId = '52100000-0000-4000-8000-000000000008'
beforeEach(() => { vi.clearAllMocks() })

describe('AC-052.1: the switch', () => {
  test('AC-052.1.18: when registration is on, it says so and offers to disable it, keeping existing registrations', () => {
    render(<RegistrationSettingPanel eventId={eventId} enabled onChanged={vi.fn()} />)
    expect(screen.getByText('enabled')).toBeInTheDocument()
    expect(screen.getByText(/existing registrations are kept/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable registration' })).toBeEnabled()
  })

  test('AC-052.1.19: when registration is off, it says so and offers to enable it', () => {
    render(<RegistrationSettingPanel eventId={eventId} enabled={false} onChanged={vi.fn()} />)
    expect(screen.getByText('disabled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable registration' })).toBeEnabled()
  })

  test('AC-052.1.20: clicking asks for the opposite value and then tells the page to reload', async () => {
    mocks.set.mockResolvedValue({ ok: true })
    const onChanged = vi.fn()
    render(<RegistrationSettingPanel eventId={eventId} enabled onChanged={onChanged} />)
    await userEvent.click(screen.getByRole('button', { name: 'Disable registration' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(mocks.set).toHaveBeenCalledWith(eventId, false)
  })

  test('AC-052.1.21: a refusal is shown, the page is not reloaded as if it worked, and the coordinator can retry', async () => {
    mocks.set.mockResolvedValueOnce({ ok: false, reason: 'Only the coordinator assigned to this event can change registration.' })
    mocks.set.mockResolvedValueOnce({ ok: true })
    const onChanged = vi.fn()
    render(<RegistrationSettingPanel eventId={eventId} enabled={false} onChanged={onChanged} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enable registration' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the coordinator assigned')
    expect(onChanged).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Enable registration' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('AC-052.1.22: a second click while the first is saving sends nothing more', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    mocks.set.mockReturnValue(new Promise(resolve => { finish = resolve }))
    render(<RegistrationSettingPanel eventId={eventId} enabled onChanged={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Disable registration' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Saving…' }))
    expect(mocks.set).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disable registration' })).toBeEnabled())
  })
})

describe('AC-052.5: the organiser sees whether registration is enabled', () => {
  const request: EventRequestDetail = {
    id: eventId, reference: 'EVT-2026-0052', organiserId: 'organiser-1', coordinatorId: 'coordinator-1',
    name: 'Toggle Meetup', purpose: 'Meetup', eventType: 'Meetup', description: null,
    proposedStart: '2099-06-01T10:00:00Z', proposedEnd: '2099-06-01T14:00:00Z',
    expectedAttendance: 50, programme: null, layoutPreference: null, accessibilityRequirements: [],
    facilityRequirements: [], equipmentRequirements: [], registrationRequired: true,
    specialArrangements: null, status: 'confirmed', submittedAt: '2099-05-01T10:00:00Z',
    reviewNote: null, reviewedAt: null, createdAt: '2099-05-01T09:00:00Z',
  }
  const valueFor = (label: string) => screen.getByText(label).nextElementSibling

  test('AC-052.5.3: the request details show registration as Enabled', () => {
    render(<RequestDetails request={request} />)
    expect(valueFor('Attendee registration')).toHaveTextContent('Enabled')
  })

  test('AC-052.5.4: and as Disabled after the coordinator switches it off', () => {
    render(<RequestDetails request={{ ...request, registrationRequired: false }} />)
    expect(valueFor('Attendee registration')).toHaveTextContent('Disabled')
  })
})
