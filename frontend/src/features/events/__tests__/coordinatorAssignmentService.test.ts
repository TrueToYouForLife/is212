import { beforeEach, describe, expect, test, vi } from 'vitest'
import { assignEventCoordinator, listAssignmentCoordinators } from '../coordinatorAssignmentService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '17100000-0000-0000-0000-000000000010'
const coordinatorId = '17000000-0000-0000-0000-000000000003'
const option = { coordinator_id: coordinatorId, full_name: 'Alice', active_event_count: 0 }

beforeEach(() => { vi.resetAllMocks() })

describe('AC-017.1', () => {
  test('AC-017.1.13: a permission refusal explains that a Coordinator Lead is required', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Private permission detail' } })
    await expect(assignEventCoordinator(eventId, coordinatorId)).resolves.toEqual({
      ok: false, reason: 'Only a Coordinator Lead can save this assignment.',
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('assign_event_coordinator', {
      p_event_id: eventId, p_coordinator_id: coordinatorId,
    })
  })
})

describe('AC-017.2', () => {
  test('AC-017.2.10: picker results retain identities and workloads, including idle coordinators and an empty list', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [option], error: null })
    await expect(listAssignmentCoordinators()).resolves.toEqual({
      ok: true, value: [{ id: coordinatorId, name: 'Alice', activeEventCount: 0 }],
    })
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
    await expect(listAssignmentCoordinators()).resolves.toEqual({ ok: true, value: [] })
    expect(mocks.rpc.mock.calls).toEqual([
      ['list_assignment_coordinators'], ['list_assignment_coordinators'],
    ])
  })

  test('AC-017.2.11: picker database and connection failures return a safe error rather than an empty success', async () => {
    const failed = { ok: false, reason: 'The coordinator list could not be loaded. Please try again.' }
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Private database detail' } })
    await expect(listAssignmentCoordinators()).resolves.toEqual(failed)
    mocks.rpc.mockRejectedValueOnce(new Error('Private connection detail'))
    await expect(listAssignmentCoordinators()).resolves.toEqual(failed)
    expect(mocks.rpc.mock.calls).toEqual([
      ['list_assignment_coordinators'], ['list_assignment_coordinators'],
    ])
  })

  test('AC-017.2.12: invalid picker identities or workloads reject the response without offering a partial list', async () => {
    for (const invalid of [
      { ...option, coordinator_id: 'not-a-coordinator-id' },
      { ...option, active_event_count: -1 },
    ]) {
      mocks.rpc.mockResolvedValueOnce({ data: [option, invalid], error: null })
      await expect(listAssignmentCoordinators()).resolves.toEqual({
        ok: false, reason: 'The coordinator list could not be loaded. Please try again.',
      })
    }
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })

  test('AC-017.2.13: missing or malformed event/coordinator IDs are refused before any assignment request', async () => {
    for (const [event, coordinator] of [
      ['', coordinatorId], ['not-an-event-id', coordinatorId],
      [eventId, ''], [eventId, 'not-a-coordinator-id'],
    ]) {
      await expect(assignEventCoordinator(event, coordinator)).resolves.toEqual({
        ok: false, reason: 'Choose a coordinator for a valid event before saving.',
      })
    }
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-017.2.14: an unavailable event or coordinator asks for refresh without retrying the assignment', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22000', message: 'Private stale-row detail' } })
    await expect(assignEventCoordinator(eventId, coordinatorId)).resolves.toEqual({
      ok: false,
      reason: 'The event or coordinator is no longer available for assignment. Refresh requests and try again.',
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-017.2.15: an unknown database refusal reports failure without leaking details or retrying', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'Private schema detail' } })
    await expect(assignEventCoordinator(eventId, coordinatorId)).resolves.toEqual({
      ok: false, reason: 'The assignment could not be saved. Please try again.',
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-017.2.16: a lost assignment response reports an uncertain outcome and never automatically writes again', async () => {
    mocks.rpc.mockRejectedValue(new Error('Response lost after sending assignment'))
    await expect(assignEventCoordinator(eventId, coordinatorId)).resolves.toEqual({
      ok: false,
      reason: 'The assignment could not be confirmed. Refresh requests to check before trying again.',
    })
    expect(mocks.rpc.mock.calls).toEqual([['assign_event_coordinator', {
      p_event_id: eventId, p_coordinator_id: coordinatorId,
    }]])
  })
})
