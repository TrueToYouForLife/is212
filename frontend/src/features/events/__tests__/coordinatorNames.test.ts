import { beforeEach, describe, expect, test, vi } from 'vitest'
import { describeCoordinator } from '../coordinatorLabel'
import { COORDINATOR_NAME_MESSAGES, loadCoordinatorNames } from '../eventCoordinatorService'

/** US17 AC4: the Requests list names the assigned Coordinator. Pure wording first, then the lookup. */
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => { vi.resetAllMocks() })

describe('AC-017.4: what a request card says about the Coordinator', () => {
  test('AC-017.4.13: someone else\'s event names that Coordinator', () => {
    expect(describeCoordinator('c-2', 'Cleo Coord', 'c-1')).toBe('Cleo Coord')
  })

  test('AC-017.4.14: the viewer\'s own event names them and says it is them', () => {
    expect(describeCoordinator('c-1', 'Cory Coord', 'c-1')).toBe('Cory Coord (you)')
  })

  test('AC-017.4.15: an event nobody is assigned to says so; only an explicit null means that', () => {
    expect(describeCoordinator(null, undefined, 'c-1')).toBe('No coordinator assigned')
    expect(describeCoordinator(undefined, undefined, 'c-1')).toBeNull()
  })

  test('AC-017.4.16: if the name could not be loaded it says someone is assigned, without guessing who', () => {
    expect(describeCoordinator('c-2', undefined, 'c-1')).toBe('Coordinator assigned')
    expect(describeCoordinator('c-1', undefined, 'c-1')).toBe('You')
  })
})

describe('AC-017.4: looking the names up', () => {
  test('AC-017.4.17: maps each event to its Coordinator\'s name', async () => {
    mocks.rpc.mockResolvedValue({ data: [
      { event_id: 'e-1', coordinator_name: 'Cory Coord' }, { event_id: 'e-3', coordinator_name: 'Cleo Coord' },
    ], error: null })
    expect(await loadCoordinatorNames(['e-1', 'e-2', 'e-3'])).toEqual({
      ok: true, value: { 'e-1': 'Cory Coord', 'e-3': 'Cleo Coord' },
    })
    expect(mocks.rpc).toHaveBeenCalledWith('event_coordinator_names', { p_event_ids: ['e-1', 'e-2', 'e-3'] })
  })

  test('AC-017.4.18: no events means no request at all', async () => {
    expect(await loadCoordinatorNames([])).toEqual({ ok: true, value: {} })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-017.4.19: more than 500 events are asked for in chunks, within the database\'s limit', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const ids = Array.from({ length: 1201 }, (_, index) => `e-${index}`)
    await loadCoordinatorNames(ids)
    const sizes = mocks.rpc.mock.calls.map((call) => (call[1] as { p_event_ids: string[] }).p_event_ids.length)
    expect(sizes).toEqual([500, 500, 201])
  })

  test('AC-017.4.20: a failed lookup says so without the raw error, so the cards fall back', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'internal' } })
    expect(await loadCoordinatorNames(['e-1'])).toEqual({ ok: false, reason: COORDINATOR_NAME_MESSAGES.loadFailed })
  })
})
