import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WithdrawRegistrationButton } from '../components/WithdrawRegistrationButton'
import type { MyRegistration } from '../types'

const mocks = vi.hoisted(() => ({ withdrawRegistration: vi.fn() }))
vi.mock('../registrationService', () => ({ withdrawRegistration: mocks.withdrawRegistration }))

const registration: MyRegistration = {
  registrationId: 'r-1', eventId: 'e-1', eventName: 'Data Workshop',
  start: '2035-03-10T01:00:00Z', end: null, venue: null,
  eventStatus: 'confirmed', eventStatusLabel: 'Confirmed',
  registrationStatus: 'registered', registrationStatusLabel: 'Registered',
}

const onWithdrawn = vi.fn()
const onStale = vi.fn()

function renderButton() {
  render(<WithdrawRegistrationButton registration={registration} onWithdrawn={onWithdrawn} onStale={onStale} />)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AC-023.2: the Attendee confirms before the withdrawal takes effect', () => {
  test('AC-023.2.1: clicking Withdraw asks first and names the event; nothing is sent yet', () => {
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Withdraw from Data Workshop?')
    expect(mocks.withdrawRegistration).not.toHaveBeenCalled()
  })

  test('AC-023.2.2: backing out sends nothing and leaves the registration alone', () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    fireEvent.click(screen.getByRole('button', { name: 'Keep my registration' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
    expect(mocks.withdrawRegistration).not.toHaveBeenCalled()
    expect(onWithdrawn).not.toHaveBeenCalled()
  })

  test('AC-023.2.3: confirming withdraws once and tells the page which event', async () => {
    mocks.withdrawRegistration.mockResolvedValue({ ok: true })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }))

    await waitFor(() => expect(onWithdrawn).toHaveBeenCalledWith('Data Workshop'))
    expect(mocks.withdrawRegistration).toHaveBeenCalledTimes(1)
    expect(mocks.withdrawRegistration).toHaveBeenCalledWith('r-1')
  })

  test('AC-023.2.4: a failed withdrawal says so, keeps the registration and lets the Attendee retry', async () => {
    mocks.withdrawRegistration.mockResolvedValue({
      ok: false, reason: 'Your registration could not be withdrawn. Please try again.', stale: false,
    })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))

    fireEvent.click(screen.getByRole('button', { name: 'Yes, withdraw' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be withdrawn')
    expect(onWithdrawn).not.toHaveBeenCalled()
    expect(onStale).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeEnabled()
  })

  test('AC-023.2.5: a double click on Yes, withdraw sends one request (boundary)', async () => {
    mocks.withdrawRegistration.mockReturnValue(new Promise(() => {}))
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    const confirm = screen.getByRole('button', { name: 'Yes, withdraw' })

    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(mocks.withdrawRegistration).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: 'Withdrawing…' })).toBeDisabled()
  })
})
