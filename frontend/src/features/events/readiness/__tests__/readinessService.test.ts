import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { READINESS_MESSAGES as messages, getEventReadiness } from '../readinessService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-005.1 — the Coordinator sees the status of each required arrangement', () => {
  test('AC-005.1.2: the readiness is read in one call and comes back in the database\'s order', async () => {
    mocks.rpc.mockResolvedValue({ data: [
      { arrangement: 'programme', label: 'Programme', complete: false, detail: 'No programme yet.', sort_order: 4 },
      { arrangement: 'venue_booking', label: 'Venue booking', complete: true, detail: '1 venue booking approved.', sort_order: 1 },
    ], error: null })
    expect(await getEventReadiness('e-1')).toEqual({ ok: true, lines: [
      { arrangement: 'venue_booking', label: 'Venue booking', complete: true, detail: '1 venue booking approved.', sortOrder: 1 },
      { arrangement: 'programme', label: 'Programme', complete: false, detail: 'No programme yet.', sortOrder: 4 },
    ] })
    expect(mocks.rpc).toHaveBeenCalledWith('get_event_readiness', { p_event_id: 'e-1' })
  })

  test('AC-005.1.3: an empty answer is an empty summary; a failed or unexpected one is reported and logged', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getEventReadiness('e-1')).toEqual({ ok: true, lines: [] })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await getEventReadiness('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ arrangement: 'programme' }], error: null })
    expect(await getEventReadiness('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe('AC-005.4 — only the assigned Coordinator sees the readiness', () => {
  test('AC-005.4.2: anyone else is told it is for the assigned Coordinator; an unknown event is not found', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'no' } })
    expect(await getEventReadiness('e-1')).toEqual({ ok: false, reason: messages.notAssigned })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'Event not found' } })
    expect(await getEventReadiness('e-1')).toEqual({ ok: false, reason: messages.notFound })
  })
})
