import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { CoordinatorAssignmentQueue } from '../components/CoordinatorAssignmentQueue'
import type { EventRequestSummary } from '../types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
// Keep the queue, card, form and service real; replace only the database boundary.
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const currentId = '17000000-0000-0000-0000-000000000003'
const replacementId = '17000000-0000-0000-0000-000000000005'
const request: EventRequestSummary = {
  id: '17100000-0000-0000-0000-000000000010', reference: 'EVT-017-010',
  organiserId: 'organiser', coordinatorId: null, name: 'Community workshop',
  purpose: 'Teach first aid', eventType: 'Workshop',
  proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
  expectedAttendance: 40, status: 'submitted', submittedAt: '2029-12-01T01:00:00Z',
  reviewNote: null,
}

beforeEach(() => { vi.resetAllMocks() })

test('AC-017.2.19: an empty coordinator list explains how to recover and prevents assignment', async () => {
  const user = userEvent.setup()
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  const assigned = vi.fn()
  render(<MemoryRouter><CoordinatorAssignmentQueue requests={[request]} onAssigned={assigned} /></MemoryRouter>)

  expect(await screen.findByText('No Event Coordinator accounts are available. Contact your administrator.'))
    .toBeInTheDocument()
  expect(screen.queryByText('Loading coordinators…')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Coordinator workloads' })).not.toBeInTheDocument()
  expect(screen.getByText('Community workshop')).toBeInTheDocument()
  expect(screen.getByText('Current coordinator: Unassigned')).toBeInTheDocument()
  const picker = screen.getByRole('combobox', { name: 'Coordinator for Community workshop' })
  expect(picker).toBeDisabled()
  expect(within(picker).getAllByRole('option')).toHaveLength(1)
  const save = screen.getByRole('button', { name: 'Assign coordinator' })
  expect(save).toBeDisabled()
  await user.click(save)
  expect(assigned).not.toHaveBeenCalled()
  expect(mocks.rpc.mock.calls).toEqual([['list_assignment_coordinators']])
})

test('AC-017.3.4: a missing current coordinator is distinguished from loading and can be replaced by an available account', async () => {
  const user = userEvent.setup()
  type PickerResult = { data: { coordinator_id: string; full_name: string; active_event_count: number }[]; error: null }
  let finishPicker!: (result: PickerResult) => void
  const initialPicker = new Promise<PickerResult>((resolve) => { finishPicker = resolve })
  const available = { data: [{ coordinator_id: replacementId, full_name: 'Bob', active_event_count: 0 }], error: null }
  mocks.rpc.mockImplementation((operation: string) => {
    if (operation === 'list_assignment_coordinators') return initialPicker
    if (operation === 'assign_event_coordinator') return Promise.resolve({ data: null, error: null })
    throw new Error(`Unexpected database operation: ${operation}`)
  })
  const assigned = vi.fn()
  render(<MemoryRouter><CoordinatorAssignmentQueue requests={[{ ...request, coordinatorId: currentId }]}
    onAssigned={assigned} /></MemoryRouter>)

  expect(screen.getByText('Loading coordinators…')).toBeInTheDocument()
  expect(screen.getByText('Current coordinator: Loading unavailable')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Coordinator for Community workshop' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reassign coordinator' })).toBeDisabled()
  await act(async () => { finishPicker(available) })

  expect(screen.queryByText('Loading coordinators…')).not.toBeInTheDocument()
  expect(screen.getByText('Current coordinator: Coordinator no longer available')).toBeInTheDocument()
  const picker = screen.getByRole('combobox', { name: 'Coordinator for Community workshop' })
  expect(picker).toBeEnabled()
  expect(within(picker).getByRole('option', { name: 'Bob — 0 active events' })).toBeInTheDocument()
  expect(within(picker).getAllByRole('option').map(option => (option as HTMLOptionElement).value))
    .toEqual(['', replacementId])
  await user.selectOptions(picker, replacementId)
  await user.click(screen.getByRole('button', { name: 'Reassign coordinator' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Coordinator reassigned successfully.')
  expect(assigned).toHaveBeenCalledTimes(1)
  expect(mocks.rpc.mock.calls.filter(([operation]) => operation === 'assign_event_coordinator')).toEqual([
    ['assign_event_coordinator', { p_event_id: request.id, p_coordinator_id: replacementId }],
  ])
  expect(picker).toHaveValue('')
})
