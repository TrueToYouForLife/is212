import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SAFETY_SEND_MESSAGES as messages, sendForSafetyReview } from '../readinessService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-043.1 — the Coordinator sends an event for review once its arrangements are complete', () => {
  test('AC-043.1.16: sending calls the database once for the event, and each refusal says why', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 'awaiting_safety_review', error: null })
    expect(await sendForSafetyReview('e-1')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('send_for_safety_review', { p_event_id: 'e-1' })
    for (const [code, reason] of [['55000', messages.notReady], ['22000', messages.notPlanning], ['42501', messages.notAssigned], ['08006', messages.failed]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'x' } })
      expect(await sendForSafetyReview('e-1')).toEqual({ ok: false, reason })
    }
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})
