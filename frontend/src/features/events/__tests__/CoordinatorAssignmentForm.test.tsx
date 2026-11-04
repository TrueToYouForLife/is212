import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CoordinatorAssignmentForm } from '../components/CoordinatorAssignmentForm'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
// Keep assignment validation and error mapping real; replace only the database boundary.
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '17100000-0000-0000-0000-000000000010'
const aliceId = '17000000-0000-0000-0000-000000000003'
const bobId = '17000000-0000-0000-0000-000000000005'
const coordinators = [
  { id: aliceId, name: 'Alice', activeEventCount: 1 },
  { id: bobId, name: 'Bob', activeEventCount: 0 },
]

beforeEach(() => { vi.resetAllMocks() })

describe('AC-017.2', () => {
  test('AC-017.2.17: a pending assignment locks selection and repeated clicks, then resets only after confirmed success', async () => {
    const user = userEvent.setup()
    let finish!: (result: { data: null; error: null }) => void
    mocks.rpc.mockReturnValue(new Promise<{ data: null; error: null }>((resolve) => { finish = resolve }))
    const assigned = vi.fn()
    render(<CoordinatorAssignmentForm eventId={eventId} eventName="Workshop"
      coordinators={coordinators} disabled={false} onAssigned={assigned} />)
    const picker = screen.getByRole('combobox', { name: 'Coordinator for Workshop' })
    const save = screen.getByRole('button', { name: 'Assign coordinator' })
    expect(save).toBeDisabled()
    await user.selectOptions(picker, bobId)
    await user.click(save)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(picker).toBeDisabled()
    expect(picker).toHaveValue(bobId)
    expect(assigned).not.toHaveBeenCalled()
    await user.dblClick(save)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ data: null, error: null }) })
    expect(assigned).toHaveBeenCalledTimes(1)
    expect(picker).toBeEnabled()
    expect(picker).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Assign coordinator' })).toBeDisabled()
    expect(mocks.rpc.mock.calls).toEqual([['assign_event_coordinator', {
      p_event_id: eventId, p_coordinator_id: bobId,
    }]])
  })

  test('AC-017.2.18: a failed assignment preserves selection and choosing another coordinator clears the error', async () => {
    const user = userEvent.setup()
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'Private database detail' } })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    const assigned = vi.fn()
    render(<CoordinatorAssignmentForm eventId={eventId} eventName="Workshop"
      coordinators={coordinators} disabled={false} onAssigned={assigned} />)
    const picker = screen.getByRole('combobox', { name: 'Coordinator for Workshop' })
    await user.selectOptions(picker, aliceId)
    await user.click(screen.getByRole('button', { name: 'Assign coordinator' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The assignment could not be saved. Please try again.')
    expect(picker).toHaveValue(aliceId)
    expect(picker).toBeEnabled()
    expect(assigned).not.toHaveBeenCalled()
    await user.selectOptions(picker, bobId)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Assign coordinator' }))
    expect(assigned).toHaveBeenCalledTimes(1)
    expect(picker).toHaveValue('')
    expect(mocks.rpc.mock.calls).toEqual([
      ['assign_event_coordinator', { p_event_id: eventId, p_coordinator_id: aliceId }],
      ['assign_event_coordinator', { p_event_id: eventId, p_coordinator_id: bobId }],
    ])
  })
})

describe('AC-017.3', () => {
  test('AC-017.3.3: the current coordinator, disabled form and empty picker cannot send reassignment requests', async () => {
    const user = userEvent.setup()
    const assigned = vi.fn()
    const props = { eventId, eventName: 'Workshop', currentCoordinatorId: aliceId, coordinators,
      disabled: false, onAssigned: assigned }
    const rendered = render(<CoordinatorAssignmentForm {...props} />)
    const picker = screen.getByRole('combobox', { name: 'Coordinator for Workshop' })
    const save = screen.getByRole('button', { name: 'Reassign coordinator' })
    await user.selectOptions(picker, aliceId)
    expect(save).toBeDisabled()
    await user.click(save)
    await user.selectOptions(picker, bobId)
    expect(save).toBeEnabled()
    rendered.rerender(<CoordinatorAssignmentForm {...props} disabled />)
    expect(picker).toBeDisabled()
    expect(save).toBeDisabled()
    await user.click(save)
    rendered.rerender(<CoordinatorAssignmentForm {...props} coordinators={[]} />)
    expect(picker).toBeDisabled()
    expect(save).toBeDisabled()
    await user.click(save)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(assigned).not.toHaveBeenCalled()
  })
})
