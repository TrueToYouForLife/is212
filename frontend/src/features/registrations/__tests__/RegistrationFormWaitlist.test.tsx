import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegistrationForm } from '../components/RegistrationForm'

/** US16 AC-016.3: the registration form also accepts a waiting-list offer. */
const mocks = vi.hoisted(() => ({ registerForEvent: vi.fn(), acceptWaitlistOffer: vi.fn() }))
vi.mock('../registrationService', () => ({ registerForEvent: mocks.registerForEvent }))
vi.mock('../waitlistService', () => ({ acceptWaitlistOffer: mocks.acceptWaitlistOffer }))

function renderForm(waitlistEntryId?: string) {
  render(
    <MemoryRouter>
      <RegistrationForm eventId="event-1" hasPrerequisites={false} waitlistEntryId={waitlistEntryId} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.registerForEvent.mockResolvedValue({ ok: true })
  mocks.acceptWaitlistOffer.mockResolvedValue({ ok: true })
})

describe('AC-016.3: accepting an offered place', () => {
  test('AC-016.3.19: with an offer, the form says Accept place and accepts it instead of registering', async () => {
    renderForm('entry-1')
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accept place' }))

    await waitFor(() => expect(mocks.acceptWaitlistOffer).toHaveBeenCalledTimes(1))
    expect(mocks.acceptWaitlistOffer).toHaveBeenCalledWith(
      'entry-1', expect.objectContaining({ phone: '9123 4567' }), { hasPrerequisites: false })
    expect(mocks.registerForEvent).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/you.re registered/i)
  })

  test('AC-016.3.20: a refused acceptance is shown and the answers are kept for another try', async () => {
    mocks.acceptWaitlistOffer.mockResolvedValue({
      ok: false, stale: true, reason: 'This offer is no longer available. Reload to see where you stand.',
    })
    renderForm('entry-1')
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accept place' }))

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone number/i)).toHaveValue('9123 4567')
  })

  test('AC-016.3.21: without an offer the same form still registers directly', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(mocks.registerForEvent).toHaveBeenCalledTimes(1))
    expect(mocks.acceptWaitlistOffer).not.toHaveBeenCalled()
  })
})
