import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegisterOrWaitlist } from '../components/RegisterOrWaitlist'
import type { OpenEventDetails } from '../types'

/** US16: which of register, join, wait and accept the event page offers. */
const mocks = vi.hoisted(() => ({ join: vi.fn(), leave: vi.fn() }))
vi.mock('../waitlistService', () => ({ joinWaitlist: mocks.join, leaveWaitlist: mocks.leave }))
// The form is its own unit (AC-016.3.19); here it only has to appear, and in which mode.
vi.mock('../components/RegistrationForm', () => ({
  RegistrationForm: (props: { waitlistEntryId?: string }) =>
    <p>{props.waitlistEntryId ? `Accept form for ${props.waitlistEntryId}` : 'Registration form'}</p>,
}))

const event: OpenEventDetails = {
  id: 'event-1', name: 'Data Workshop', eventType: 'Workshop', start: '2035-03-10T01:00:00Z',
  end: '2035-03-10T09:00:00Z', venue: null, registered: false, description: null, programme: null,
  prerequisites: null, full: false, waitlist: null,
}
const onChanged = vi.fn()
const onNotice = vi.fn()

function renderIt(overrides: Partial<OpenEventDetails>) {
  render(
    <MemoryRouter>
      <RegisterOrWaitlist event={{ ...event, ...overrides }} hasPrerequisites={false}
        onChanged={onChanged} onNotice={onNotice} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.join.mockResolvedValue({ ok: true })
  mocks.leave.mockResolvedValue({ ok: true })
})

describe('AC-016.1: a full event offers the waiting list instead of registration', () => {
  test('AC-016.1.13: a full event shows Join the waiting list and no registration form', () => {
    renderIt({ full: true })
    expect(screen.getByRole('button', { name: 'Join the waiting list' })).toBeEnabled()
    expect(screen.getByText(/this event is full/i)).toBeInTheDocument()
    expect(screen.queryByText('Registration form')).not.toBeInTheDocument()
  })

  test('AC-016.1.14: joining asks for this event and then reloads the page', async () => {
    renderIt({ full: true })
    fireEvent.click(screen.getByRole('button', { name: 'Join the waiting list' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(mocks.join).toHaveBeenCalledWith('event-1')
  })

  test('AC-016.1.15: an event with places left shows the registration form, not the waiting list', () => {
    renderIt({ full: false })
    expect(screen.getByText('Registration form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join the waiting list' })).not.toBeInTheDocument()
  })

  test('AC-016.1.16: an attendee who is registered sees that, not the waiting list', () => {
    renderIt({ registered: true, full: true })
    expect(screen.getByText(/you.re registered for this event/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join the waiting list' })).not.toBeInTheDocument()
  })
})

describe('AC-016.2: waiting in the queue', () => {
  test('AC-016.2.11: someone waiting sees their position and can leave', async () => {
    renderIt({ full: true, waitlist: { entryId: 'entry-1', status: 'waiting', position: 3, offerExpiresAt: null } })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join the waiting list' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Leave the waiting list' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(mocks.leave).toHaveBeenCalledWith('entry-1')
  })
})

describe('AC-016.3: an offered place', () => {
  test('AC-016.3.18: an open offer shows its deadline and the form that accepts it', () => {
    renderIt({ full: true, waitlist: {
      entryId: 'entry-1', status: 'offered', position: null, offerExpiresAt: '2099-03-05T01:00:00Z',
    } })
    expect(screen.getByText(/a place is being held for you until/i)).toBeInTheDocument()
    expect(screen.getByText('Accept form for entry-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave the waiting list' })).toBeEnabled()
  })
})

describe('AC-016.4: an offer that was not accepted in time', () => {
  test('AC-016.4.12: a lapsed offer says so and offers the waiting list again', () => {
    renderIt({ full: true, waitlist: {
      entryId: 'entry-1', status: 'offered', position: null, offerExpiresAt: '2000-01-01T00:00:00Z',
    } })
    expect(screen.getByText(/your offer expired/i)).toBeInTheDocument()
    expect(screen.queryByText(/accept form/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join the waiting list' })).toBeEnabled()
  })
})

describe('AC-016.5: no joining twice', () => {
  test('AC-016.5.10: if the list changed since the page loaded, the reason is shown and the page reloads', async () => {
    mocks.join.mockResolvedValue({ ok: false, stale: true, reason: 'You are already on the waiting list for this event.' })
    renderIt({ full: true })
    fireEvent.click(screen.getByRole('button', { name: 'Join the waiting list' }))
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('You are already on the waiting list for this event.'))
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  test('AC-016.5.11: a second click while joining is ignored', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    mocks.join.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    renderIt({ full: true })
    const button = screen.getByRole('button', { name: 'Join the waiting list' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(mocks.join).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })
})
