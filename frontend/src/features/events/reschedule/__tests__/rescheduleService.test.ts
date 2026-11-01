import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RESCHEDULE_MESSAGES as messages, canReschedule, rescheduleEvent } from '../rescheduleService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-021.1 — the Coordinator reschedules', () => {
  test('AC-021.1.10: one call carries the new times and the trimmed reason; each refusal says why', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'planning', error: null })
    expect(await rescheduleEvent('e-1', '2047-06-12T11:00:00.000Z', '2047-06-12T14:00:00.000Z', '  Headliner delayed ')).toEqual({ ok: true, status: 'planning' })
    expect(mocks.rpc).toHaveBeenCalledWith('reschedule_event', {
      p_event_id: 'e-1', p_start: '2047-06-12T11:00:00.000Z', p_end: '2047-06-12T14:00:00.000Z', p_reason: 'Headliner delayed',
    })
    mocks.rpc.mockResolvedValueOnce({ data: 'approved', error: null })
    await rescheduleEvent('e-1', 'a', 'b', '   ')
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_reason: null })
    for (const [code, reason] of [['42501', messages.notAllowed], ['22000', messages.notReschedulable],
      ['22023', 'The new date must be in the future'], ['08006', messages.failed]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: code === '22023' ? 'The new date must be in the future' : 'x' } })
      expect(await rescheduleEvent('e-1', 'a', 'b', '')).toEqual({ ok: false, reason })
    }
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  test('AC-021.1.11: an event can be rescheduled at any stage before it is completed, cancelled or closed', () => {
    for (const status of ['approved', 'planning', 'awaiting_safety_review', 'safety_changes_requested', 'in_preparation', 'confirmed', 'postponed'] as const) {
      expect(canReschedule(status)).toBe(true)
    }
    for (const status of ['draft', 'submitted', 'under_review', 'completed', 'cancelled', 'rejected', 'withdrawn'] as const) {
      expect(canReschedule(status)).toBe(false)
    }
  })
})
