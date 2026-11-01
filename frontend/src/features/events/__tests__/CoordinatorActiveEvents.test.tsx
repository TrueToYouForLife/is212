vi.mock('../arrangementReviewService', () => ({ listArrangementReviewCounts: vi.fn().mockResolvedValue({ ok: true, value: {} }) }))
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ReviewRequestsPage } from '../pages/ReviewRequestsPage'
import type { EventRequestSummary } from '../types'

const mocks = vi.hoisted(() => ({ list: vi.fn(), options: vi.fn(), assign: vi.fn(), role: 'coordinator_lead' }))
vi.mock('../eventReviewService', () => ({ listEventRequests: mocks.list }))
vi.mock('../coordinatorAssignmentService', () => ({
  listAssignmentCoordinators: mocks.options, assignEventCoordinator: mocks.assign,
}))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'viewer', role: mocks.role } }),
}))

const base: EventRequestSummary = {
  id: 'event', reference: 'EVT-036', organiserId: 'organiser', coordinatorId: 'alice',
  name: 'Planning workshop', purpose: 'First aid', eventType: 'Workshop',
  proposedStart: '2030-01-03T01:00:00Z', proposedEnd: '2030-01-03T03:00:00Z',
  expectedAttendance: 40, status: 'planning', submittedAt: '2029-12-01T01:00:00Z', reviewNote: null,
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role = 'coordinator_lead'
  mocks.list.mockResolvedValue({ ok: true, requests: [base] })
  mocks.options.mockResolvedValue({ ok: true, value: [
    { id: 'alice', name: 'Alice', activeEventCount: 1 },
    { id: 'bob', name: 'Bob', activeEventCount: 0 },
  ] })
})
function show() { return render(<MemoryRouter><ReviewRequestsPage /></MemoryRouter>) }

test('AC-036.1.1: overview shows all active events once with coordinator status and Singapore dates, excluding inactive events', async () => {
  const active = ['submitted', 'under_review', 'approved', 'planning', 'confirmed'] as const
  const inactive = ['draft', 'completed', 'cancelled', 'rejected'] as const
  mocks.list.mockResolvedValue({ ok: true, requests: [
    ...active.map(status => ({ ...base, id: status, name: `Event ${status}`, status })),
    ...inactive.map(status => ({ ...base, id: status, name: `Hidden ${status}`, status })),
    // Future/unknown server statuses must not accidentally become active.
    { ...base, id: 'withdrawn', name: 'Hidden withdrawn', status: 'withdrawn' },
    { ...base, id: 'unassigned-planning', name: 'Unassigned planning', coordinatorId: null },
    { ...base, id: 'unassigned-submitted', name: 'Waiting request', coordinatorId: null, status: 'submitted' },
  ] })
  const user = userEvent.setup()
  show()
  await screen.findAllByText('Current coordinator: Alice')
  for (const status of active) expect(screen.getAllByText(`Event ${status}`)).toHaveLength(1)
  for (const status of [...inactive, 'withdrawn']) expect(screen.queryByText(`Hidden ${status}`)).not.toBeInTheDocument()
  const events = screen.getByRole('region', { name: 'Active events' })
  const planning = within(events).getAllByRole('listitem').find(item => item.textContent?.includes('Event planning'))!
  expect(within(planning).getByText('Planning')).toBeInTheDocument()
  expect(within(planning).getByText('Current coordinator: Alice')).toBeInTheDocument()
  expect(within(planning).getByText(/3 Jan 2030, 09:00/)).toBeInTheDocument()
  expect(within(events).getByText('Unassigned planning')).toBeInTheDocument()
  expect(within(events).getAllByText('Current coordinator: Unassigned')[0]).toBeInTheDocument()
  expect(screen.getAllByText('Waiting request')).toHaveLength(1)
  expect(within(screen.getByRole('region', { name: 'Active events' })).getByText('Waiting request')).toBeInTheDocument()
  mocks.list.mockResolvedValue({ ok: true, requests: [] })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  expect(await screen.findByText('No active events.')).toBeInTheDocument()
  expect(screen.queryByText('Event planning')).not.toBeInTheDocument()
})

test('AC-036.2.1: filters combine coordinator and status, handle unassigned and no matches, reset and refresh without changing workloads', async () => {
  const rows: EventRequestSummary[] = [
    base,
    { ...base, id: 'confirmed', name: 'Alice confirmed', status: 'confirmed' },
    { ...base, id: 'bob', name: 'Bob planning', coordinatorId: 'bob' },
    { ...base, id: 'waiting', name: 'Waiting request', coordinatorId: null, status: 'submitted' },
    { ...base, id: 'unassigned', name: 'Unassigned planning', coordinatorId: null },
  ]
  mocks.list.mockResolvedValue({ ok: true, requests: rows })
  mocks.options.mockResolvedValue({ ok: true, value: [
    { id: 'alice', name: 'Alice', activeEventCount: 2 },
    { id: 'bob', name: 'Bob', activeEventCount: 1 },
  ] })
  const user = userEvent.setup()
  show()
  await screen.findByText('Current coordinator: Bob')
  const coordinator = screen.getByRole('combobox', { name: 'Filter by coordinator' })
  const status = screen.getByRole('combobox', { name: 'Filter by status' })
  const reset = screen.getByRole('button', { name: 'Reset filters' })
  const names = () => screen.queryAllByRole('heading', { level: 3 }).map(el => el.textContent)
  expect(reset).toBeDisabled()
  expect(names()).toEqual(['Planning workshop', 'Alice confirmed', 'Bob planning', 'Waiting request', 'Unassigned planning'])
  await user.selectOptions(coordinator, 'alice')
  expect(names()).toEqual(['Planning workshop', 'Alice confirmed'])
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  await user.selectOptions(status, 'confirmed')
  expect(names()).toEqual(['Alice confirmed'])
  await user.selectOptions(coordinator, 'bob')
  expect(names()).toEqual([])
  expect(screen.getByText('No active events match these filters.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active events' })).toBeInTheDocument()
  const workloads = screen.getByRole('region', { name: 'Coordinator workloads' })
  expect(within(workloads).getByText('Alice').parentElement).toHaveTextContent('2 active events')
  expect(within(workloads).getByText('Bob').parentElement).toHaveTextContent('1 active event')
  await user.selectOptions(coordinator, '')
  expect(names()).toEqual(['Alice confirmed'])
  await user.selectOptions(status, 'planning')
  expect(names()).toEqual(['Planning workshop', 'Bob planning', 'Unassigned planning'])
  await user.selectOptions(coordinator, 'unassigned')
  expect(names()).toEqual(['Unassigned planning'])
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active events' })).toBeInTheDocument()
  await user.selectOptions(status, 'submitted')
  expect(names()).toEqual(['Waiting request'])
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active events' })).toBeInTheDocument()
  await user.click(reset)
  expect(coordinator).toHaveValue('')
  expect(status).toHaveValue('')
  expect(names()).toHaveLength(5)
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active events' })).toBeInTheDocument()
  expect(screen.queryByText('No active events match these filters.')).not.toBeInTheDocument()
  expect(mocks.list).toHaveBeenCalledTimes(1)
  expect(mocks.options).toHaveBeenCalledTimes(1)
  await user.selectOptions(coordinator, 'alice')
  await user.selectOptions(status, 'planning')
  mocks.list.mockResolvedValue({ ok: true, requests: rows.map(row => ({ ...row, coordinatorId: 'bob' })) })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  expect(await screen.findByText('No active events match these filters.')).toBeInTheDocument()
  expect(coordinator).toHaveValue('alice')
  expect(status).toHaveValue('planning')
  // Screenshot regression: Unassigned + all statuses, but no submitted requests.
  mocks.list.mockResolvedValue({ ok: true, requests: rows.filter(row => row.id !== 'waiting') })
  await user.click(screen.getByRole('button', { name: 'Refresh requests' }))
  await user.selectOptions(coordinator, 'unassigned')
  await user.selectOptions(status, '')
  expect(await screen.findByText('Unassigned planning')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Unassigned requests' })).not.toBeInTheDocument()
  expect(screen.queryByText(/No unassigned requests match/)).not.toBeInTheDocument()
})

test('AC-036.3.1: workload summary includes zero assignments and recovers from a failed count read', async () => {
  mocks.options.mockResolvedValueOnce({ ok: false, reason: 'Coordinator counts unavailable.' })
  const user = userEvent.setup()
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Coordinator counts unavailable.')
  expect(screen.queryByRole('region', { name: 'Coordinator workloads' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry coordinator list' }))
  const workloads = await screen.findByRole('region', { name: 'Coordinator workloads' })
  expect(within(workloads).getByText('Alice').parentElement).toHaveTextContent('1 active event')
  expect(within(workloads).getByText('Bob').parentElement).toHaveTextContent('0 active events')
})

test('AC-036.4.1: Lead can open an event and reassign it with refreshed assignment and workload totals', async () => {
  mocks.assign.mockImplementation(async () => {
    mocks.list.mockResolvedValue({ ok: true, requests: [{ ...base, coordinatorId: 'bob' }] })
    mocks.options.mockResolvedValue({ ok: true, value: [
      { id: 'alice', name: 'Alice', activeEventCount: 0 },
      { id: 'bob', name: 'Bob', activeEventCount: 1 },
    ] })
    return { ok: true, value: null }
  })
  const user = userEvent.setup()
  show()
  await screen.findByText('Current coordinator: Alice')
  expect(screen.getByRole('link', { name: 'Open event Planning workshop' })).toHaveAttribute('href', '/requests/event')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Coordinator for Planning workshop' }), 'bob')
  await user.click(screen.getByRole('button', { name: 'Reassign coordinator' }))
  expect(mocks.assign).toHaveBeenCalledWith('event', 'bob')
  expect(await screen.findByText('Current coordinator: Bob')).toBeInTheDocument()
  const workloads = screen.getByRole('region', { name: 'Coordinator workloads' })
  await waitFor(() => {
    expect(within(workloads).getByText('Alice').parentElement).toHaveTextContent('0 active events')
    expect(within(workloads).getByText('Bob').parentElement).toHaveTextContent('1 active event')
  })
})

test('AC-036.5.1: only Coordinator Lead sees the overview and requests coordinator workloads', async () => {
  for (const role of ['organiser', 'coordinator', 'operations_manager', 'venue_staff', 'tech_support', 'attendee']) {
    mocks.role = role
    const view = show()
    await screen.findByText('Planning workshop')
    expect(screen.queryByRole('heading', { name: 'Coordinator assignments' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Active events' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Coordinator workloads' })).not.toBeInTheDocument()
    expect(mocks.options).not.toHaveBeenCalled()
    view.unmount()
  }
  mocks.role = 'coordinator_lead'
  show()
  expect(await screen.findByRole('region', { name: 'Coordinator workloads' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Active events' })).toBeInTheDocument()
  expect(mocks.options).toHaveBeenCalledTimes(1)
})

test('AC-038.8.4: a Postponed event stays in the active list; a Completed one drops out of it', async () => {
  mocks.list.mockResolvedValue({ ok: true, requests: [
    { ...base, id: 'postponed', name: 'Event postponed', status: 'postponed' },
    { ...base, id: 'completed', name: 'Hidden completed', status: 'completed' },
  ] })
  show()
  const events = await screen.findByRole('region', { name: 'Active events' })
  expect(within(events).getByText('Event postponed')).toBeInTheDocument()
  expect(within(events).getByText('Postponed')).toBeInTheDocument()
  expect(screen.queryByText('Hidden completed')).not.toBeInTheDocument()
})
