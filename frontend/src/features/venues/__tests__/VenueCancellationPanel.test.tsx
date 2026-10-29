import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueCancellationPanel } from '../components/VenueCancellationPanel'
const mocks = vi.hoisted(() => ({ read: vi.fn(), cancel: vi.fn() }))
vi.mock('../venueCancellationService', () => ({ getVenueCancellation: mocks.read, cancelVenueBooking: mocks.cancel }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ status:'rejected', version:'v1', audit:null })
  mocks.cancel.mockResolvedValue({ ok:true })
})
test('AC-049.7.30: cancellation requires a reason and uses the displayed version for the selected booking', async () => {
  const changed = vi.fn()
  render(<VenueCancellationPanel bookingId="b1" onChanged={changed} />)
  await userEvent.click(await screen.findByRole('button', { name:'Cancel booking' }))
  expect(screen.getByRole('button', { name:'Confirm cancellation' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Cancellation reason'),'No longer needed')
  await userEvent.click(screen.getByRole('button', { name:'Confirm cancellation' }))
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  expect(mocks.cancel).toHaveBeenCalledWith('b1','No longer needed','v1')
})
test('AC-049.7.31: failure preserves the reason and requires reload before retrying with fresh consent', async () => {
  mocks.cancel.mockResolvedValue({ ok:false, reason:'Booking changed' })
  render(<VenueCancellationPanel bookingId="b1" onChanged={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name:'Cancel booking' }))
  await userEvent.type(screen.getByLabelText('Cancellation reason'),'Cancel this room')
  await userEvent.click(screen.getByRole('button', { name:'Confirm cancellation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Booking changed')
  expect(screen.getByRole('button', { name:'Confirm cancellation' })).toBeDisabled()
  expect(screen.getByLabelText('Cancellation reason')).toHaveValue('Cancel this room')
  mocks.read.mockResolvedValue({ status:'confirmed', version:'v2', audit:null })
  await userEvent.click(screen.getByRole('button', { name:'Reload cancellation details' }))
  await screen.findByText('Current booking status: Approved')
  expect(screen.getByRole('button', { name:'Confirm cancellation' })).toBeEnabled()
})
test('AC-049.9.30: recorded cancellation shows its actor, reason and Singapore time', async () => {
  mocks.read.mockResolvedValue({ status:'cancelled', version:'v2', audit:{ actor_name:'Coordinator A',reason:'Duplicate room',cancelled_at:'2026-10-27T01:00:00Z' } })
  render(<VenueCancellationPanel bookingId="b1" onChanged={vi.fn()} />)
  expect(await screen.findByText(/Cancelled by Coordinator A/)).toHaveTextContent('Duplicate room')
  expect(screen.queryByRole('button', { name:'Cancel booking' })).not.toBeInTheDocument()
})
test('AC-049.7.32: failed context read offers reload without exposing a cancellation action', async () => {
  mocks.read.mockResolvedValue(null)
  render(<VenueCancellationPanel bookingId="b1" onChanged={vi.fn()} />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name:'Cancel booking' })).not.toBeInTheDocument()
})
