import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), rpc: vi.fn() }))
vi.mock('../eventReviewService', () => ({ listEventRequests: mocks.list }))
// Keep the dropdown's service real: assert the database operation and payload it sends.
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({
    loading: false,
    profile: { id: 'lead', fullName: 'Coordinator Lead', role: 'coordinator_lead' },
  }),
}))

test('AC-017.1.10: Lead filters submitted unassigned requests and sees their basic details', async () => {
  const user = userEvent.setup()
  const request = {
    id: '17100000-0000-0000-0000-000000000010', reference: 'EVT-017-010',
    organiserId: 'organiser', coordinatorId: null,
    name: 'Community workshop', purpose: 'Teach first aid', eventType: 'Workshop',
    proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
    expectedAttendance: 40, status: 'submitted', submittedAt: '2029-12-01T01:00:00Z',
    reviewNote: null,
  }
  mocks.list.mockResolvedValue({ ok: true, requests: [
    request,
    { ...request, id: 'assigned', name: 'Already assigned', coordinatorId: 'coordinator' },
    { ...request, id: 'draft', name: 'Private draft', status: 'draft' },
    { ...request, id: 'completed', name: 'Completed workshop', status: 'completed' },
    { ...request, id: 'cancelled', name: 'Cancelled workshop', status: 'cancelled' },
    { ...request, id: 'rejected', name: 'Rejected workshop', status: 'rejected' },
  ] })

  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)

  // Wait for data, so a missing queue is a UI failure rather than a loading race.
  await screen.findByText('Community workshop')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by coordinator' }), 'unassigned')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'submitted')
  const queue = screen.getByRole('region', { name: /active events/i })
  expect(within(queue).getByText('EVT-017-010')).toBeInTheDocument()
  expect(within(queue).getByText('Teach first aid')).toBeInTheDocument()
  expect(within(queue).getByText('40')).toBeInTheDocument()
  expect(within(queue).getByText(/3 Jan 2030, 09:00/)).toBeInTheDocument()
  expect(within(queue).getAllByRole('listitem')).toHaveLength(1)
  for (const name of ['Already assigned', 'Private draft', 'Completed workshop', 'Cancelled workshop', 'Rejected workshop']) {
    expect(within(queue).queryByText(name)).not.toBeInTheDocument()
  }
})

test('AC-017.2.9: Lead selects a coordinator with workload shown and retries a failed assignment', async () => {
  const user = userEvent.setup()
  const eventId = '17100000-0000-0000-0000-000000000010'
  const selectedId = '17000000-0000-0000-0000-000000000005'
  const request = {
    id: eventId, reference: 'EVT-017-010', organiserId: 'organiser', coordinatorId: null,
    name: 'Community workshop', purpose: 'Teach first aid', eventType: 'Workshop',
    proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
    expectedAttendance: 40, status: 'submitted', submittedAt: '2029-12-01T01:00:00Z',
    reviewNote: null,
  }
  mocks.list.mockReset().mockResolvedValue({ ok: true, requests: [request] })
  mocks.rpc.mockReset()
  let saves = 0
  mocks.rpc.mockImplementation(async (operation: string) => {
    if (operation === 'list_assignment_coordinators') return {
      data: [
        { coordinator_id: '17000000-0000-0000-0000-000000000003', full_name: 'Alice', active_event_count: 3 },
        { coordinator_id: selectedId, full_name: 'Bob', active_event_count: saves >= 2 ? 1 : 0 },
      ], error: null,
    }
    if (operation === 'assign_event_coordinator') {
      saves += 1
      if (saves === 1) return { data: null, error: { code: 'XX000', message: 'Database unavailable' } }
      mocks.list.mockResolvedValue({ ok: true, requests: [{ ...request, coordinatorId: selectedId }] })
      return { data: null, error: null }
    }
    throw new Error(`Unexpected database operation: ${operation}`)
  })

  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
  const dropdown = await screen.findByRole('combobox', { name: /coordinator for community workshop/i })
  expect(await within(dropdown).findByRole('option', { name: /Alice.*3 active events/i })).toBeInTheDocument()
  expect(within(dropdown).getByRole('option', { name: /Bob.*0 active events/i })).toBeInTheDocument()
  const assign = screen.getByRole('button', { name: /^assign coordinator$/i })
  expect(assign).toBeDisabled()
  expect(saves).toBe(0)

  await user.selectOptions(dropdown, selectedId)
  await user.click(assign)
  expect(await screen.findByRole('alert')).toHaveTextContent(/assignment could not be saved/i)
  expect(dropdown).toHaveValue(selectedId)
  expect(screen.queryByText(/coordinator assigned successfully/i)).not.toBeInTheDocument()
  expect(screen.getByText('Community workshop')).toBeInTheDocument()
  expect(mocks.rpc).toHaveBeenCalledWith('assign_event_coordinator', {
    p_event_id: eventId, p_coordinator_id: selectedId,
  })

  await user.click(assign)
  expect(await screen.findByRole('status')).toHaveTextContent(/coordinator assigned successfully/i)
  await waitFor(() => {
    expect(screen.getByText('Current coordinator: Bob')).toBeInTheDocument()
    expect(screen.queryByText('Current coordinator: Unassigned')).not.toBeInTheDocument()
  })
  expect(saves).toBe(2)
})

test('AC-017.3.2: Lead reassigns an active event with retry feedback and no controls for closed events', async () => {
  const user = userEvent.setup()
  const eventId = '17100000-0000-0000-0000-000000000020'
  const originalId = '17000000-0000-0000-0000-000000000003'
  const replacementId = '17000000-0000-0000-0000-000000000005'
  const request = {
    id: eventId, reference: 'EVT-017-020', organiserId: 'organiser', coordinatorId: originalId,
    name: 'Assigned workshop', purpose: 'Teach first aid', eventType: 'Workshop',
    proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
    expectedAttendance: 40, status: 'approved', submittedAt: '2029-12-01T01:00:00Z', reviewNote: null,
  }
  const closed = [
    { ...request, id: 'completed', name: 'Completed workshop', status: 'completed' },
    { ...request, id: 'cancelled', name: 'Cancelled workshop', status: 'cancelled' },
  ]
  mocks.list.mockReset().mockResolvedValue({ ok: true, requests: [request, ...closed] })
  mocks.rpc.mockReset()
  let saves = 0
  mocks.rpc.mockImplementation(async (operation: string) => {
    if (operation === 'list_assignment_coordinators') return {
      data: [
        { coordinator_id: originalId, full_name: 'Alice', active_event_count: saves >= 2 ? 0 : 1 },
        { coordinator_id: replacementId, full_name: 'Bob', active_event_count: saves >= 2 ? 1 : 0 },
      ], error: null,
    }
    if (operation === 'assign_event_coordinator') {
      saves += 1
      if (saves === 1) return { data: null, error: { code: 'XX000', message: 'Database unavailable' } }
      mocks.list.mockResolvedValue({ ok: true, requests: [{ ...request, coordinatorId: replacementId }, ...closed] })
      return { data: null, error: null }
    }
    throw new Error(`Unexpected database operation: ${operation}`)
  })

  render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>)
  const assigned = await screen.findByRole('region', { name: /^active events$/i })
  expect(await within(assigned).findByText(/current coordinator: Alice/i)).toBeInTheDocument()
  const dropdown = within(assigned).getByRole('combobox', { name: /coordinator for assigned workshop/i })
  const reassign = within(assigned).getByRole('button', { name: /^reassign coordinator$/i })
  expect(reassign).toBeDisabled()
  expect(screen.queryByRole('combobox', { name: /coordinator for completed workshop/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: /coordinator for cancelled workshop/i })).not.toBeInTheDocument()
  expect(saves).toBe(0)

  await user.selectOptions(dropdown, replacementId)
  await user.click(reassign)
  expect(await within(assigned).findByRole('alert')).toHaveTextContent(/assignment could not be saved/i)
  expect(within(assigned).getByText(/current coordinator: Alice/i)).toBeInTheDocument()
  expect(dropdown).toHaveValue(replacementId)
  expect(mocks.rpc).toHaveBeenCalledWith('assign_event_coordinator', {
    p_event_id: eventId, p_coordinator_id: replacementId,
  })

  await user.click(reassign)
  expect(await screen.findByRole('status')).toHaveTextContent(/coordinator reassigned successfully/i)
  expect(await within(assigned).findByText(/current coordinator: Bob/i)).toBeInTheDocument()
  await waitFor(() => expect(within(assigned).getByRole('option', { name: /Bob.*1 active event/i })).toBeInTheDocument())
  expect(within(assigned).getByRole('button', { name: /^reassign coordinator$/i })).toBeDisabled()
  expect(saves).toBe(2)
})
