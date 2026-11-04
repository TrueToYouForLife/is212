import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueBufferSettings } from '../components/VenueBufferSettings'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
const initial = { setupMinutes: 0, turnaroundMinutes: 0, version: 'v1' }
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: initial, error: null }) })
test('AC-047.1.5: Venue Staff read defaults and save independent quarter-hour durations with review feedback', async () => {
 render(<VenueBufferSettings venueId="venue1" />)
 const setup = await screen.findByLabelText('Setup duration (minutes)')
 expect(setup).toHaveValue(0)
 fireEvent.change(setup, { target: { value: '30' } })
 fireEvent.change(screen.getByLabelText('Turnaround duration (minutes)'), { target: { value: '45' } })
 mocks.rpc.mockResolvedValue({ data: { setupMinutes: 30, turnaroundMinutes: 45, version: 'v2', reviewCount: 2 }, error: null })
 fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(await screen.findByRole('status')).toHaveTextContent('2 booking(s) need review')
 expect(mocks.rpc).toHaveBeenLastCalledWith('update_venue_buffer_settings', { p_venue_id: 'venue1', p_version: 'v1', p_setup_minutes: 30, p_turnaround_minutes: 45 })
})
test('AC-047.1.6: invalid input is refused; stale saves require reload before retrying', async () => {
 render(<VenueBufferSettings venueId="venue1" />)
 const setup = await screen.findByLabelText('Setup duration (minutes)')
 for (const value of ['', '-15', '16', '1.5']) {
  fireEvent.change(setup, { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
  expect(screen.getByRole('alert')).toHaveTextContent('multiples of 15')
 }
 expect(mocks.rpc).toHaveBeenCalledTimes(1)
 fireEvent.change(setup, { target: { value: '15' } })
 mocks.rpc.mockResolvedValue({ error: { code: '40001' } })
 fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
 await waitFor(() => expect(screen.getByRole('button', { name: 'Save timing settings' })).toBeDisabled())
 mocks.rpc.mockResolvedValue({ data: { ...initial, version: 'fresh' }, error: null })
 fireEvent.click(screen.getByText('Reload timing settings'))
 expect(await screen.findByLabelText('Setup duration (minutes)')).toHaveValue(0)
 mocks.rpc.mockResolvedValueOnce({ data: { ...initial, version: 'saved', reviewCount: 0 }, error: null })
 fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(await screen.findByRole('status')).toHaveTextContent('0 booking(s) need review')
 expect(mocks.rpc).toHaveBeenLastCalledWith('update_venue_buffer_settings', {
  p_venue_id: 'venue1', p_version: 'fresh', p_setup_minutes: 0, p_turnaround_minutes: 0,
 })
})

test('AC-047.1.10: changing venues ignores a late earlier load and saves only the current venue settings/version', async () => {
 let finish!: (value: unknown) => void
 mocks.rpc.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
 const view = render(<VenueBufferSettings venueId="venue1" />)
 expect(screen.getByText('Loading timing settings…')).toBeInTheDocument()
 expect(screen.queryByRole('button', { name: 'Save timing settings' })).not.toBeInTheDocument()
 mocks.rpc.mockResolvedValueOnce({ data: { setupMinutes: 15, turnaroundMinutes: 30, version: 'venue2-version' }, error: null })
 view.rerender(<VenueBufferSettings venueId="venue2" />)
 expect(await screen.findByLabelText('Setup duration (minutes)')).toHaveValue(15)
 await act(async () => finish({ data: { setupMinutes: 45, turnaroundMinutes: 60, version: 'old-venue1' }, error: null }))
 expect(screen.getByLabelText('Setup duration (minutes)')).toHaveValue(15)
 expect(screen.getByLabelText('Turnaround duration (minutes)')).toHaveValue(30)
 expect(mocks.rpc.mock.calls).toEqual([
  ['get_venue_buffer_settings', { p_venue_id: 'venue1' }],
  ['get_venue_buffer_settings', { p_venue_id: 'venue2' }],
 ])
 mocks.rpc.mockResolvedValueOnce({ data: { setupMinutes: 15, turnaroundMinutes: 30, version: 'saved', reviewCount: 0 }, error: null })
 fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(await screen.findByRole('status')).toHaveTextContent('Existing reservations were preserved.')
 expect(mocks.rpc).toHaveBeenLastCalledWith('update_venue_buffer_settings', {
  p_venue_id: 'venue2', p_version: 'venue2-version', p_setup_minutes: 15, p_turnaround_minutes: 30,
 })
})

test('AC-047.1.11: pending saves disable edits and duplicate clicks; a refused save preserves input without false success and a deliberate retry recovers', async () => {
 const user = userEvent.setup()
 render(<VenueBufferSettings venueId="venue1" />)
 const setup = await screen.findByLabelText('Setup duration (minutes)')
 const turnaround = screen.getByLabelText('Turnaround duration (minutes)')
 await user.clear(setup); await user.type(setup, '15')
 await user.clear(turnaround); await user.type(turnaround, '45')
 let finish!: (value: unknown) => void
 mocks.rpc.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
 await user.dblClick(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(mocks.rpc).toHaveBeenCalledTimes(2)
 expect(screen.getByRole('button', { name: 'Saving timing settings…' })).toBeDisabled()
 expect(setup).toBeDisabled(); expect(turnaround).toBeDisabled()
 await act(async () => finish({ data: null, error: { code: '42501' } }))
 expect(await screen.findByRole('alert')).toHaveTextContent('Only Venue Staff')
 expect(screen.queryByRole('status')).not.toBeInTheDocument()
 expect(setup).toHaveValue(15); expect(turnaround).toHaveValue(45)
 expect(screen.getByRole('button', { name: 'Save timing settings' })).toBeEnabled()
 mocks.rpc.mockResolvedValueOnce({ data: { setupMinutes: 15, turnaroundMinutes: 45, version: 'v2', reviewCount: 1 }, error: null })
 await user.click(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(await screen.findByRole('status')).toHaveTextContent('1 booking(s) need review')
 expect(mocks.rpc).toHaveBeenCalledTimes(3)
})
test('AC-047.1.7: load and save failures do not claim success and remain recoverable', async () => {
 mocks.rpc.mockResolvedValue({ data: { setupMinutes: -1 }, error: null })
 render(<VenueBufferSettings venueId="venue1" />)
 expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
 mocks.rpc.mockResolvedValue({ data: initial, error: null })
 fireEvent.click(screen.getByText('Reload timing settings'))
 await screen.findByLabelText('Setup duration (minutes)')
 mocks.rpc.mockRejectedValue(new Error('offline'))
 fireEvent.click(screen.getByRole('button', { name: 'Save timing settings' }))
 expect(await screen.findByRole('alert')).toHaveTextContent('Save could not be confirmed')
 expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
