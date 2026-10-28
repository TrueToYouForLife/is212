import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadRegistrationCount } from '../registrationCountService'

/**
 * US54 AC-054.4 (SCRUM-246) — the service half of the registration count.
 *
 * Mocked: these check what this module asks 0114 for and how it reports the answer back.
 * Who may learn the number is settled in event_registration_visibility.sql against real
 * RLS (AC-054.4.14 to .4.20); a mocked test could only prove this file trusts what it is
 * handed.
 */

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

beforeEach(() => { mocks.rpc.mockReset() })

describe('AC-054.4 — asking for the number', () => {
  test('AC-054.4.30: the count comes back from 0114, keyed on the event', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })

    expect(await loadRegistrationCount(EVENT)).toEqual({ ok: true, count: 3 })
    expect(mocks.rpc).toHaveBeenCalledWith('event_registration_count', { p_event_id: EVENT })
  })

  test('AC-054.4.31: zero is a real answer, not a missing one', async () => {
    // 0114 returns 0 for an empty event and for a caller who may not look alike, so the
    // service must pass it through rather than treating it as "nothing came back".
    mocks.rpc.mockResolvedValue({ data: 0, error: null })

    expect(await loadRegistrationCount(EVENT)).toEqual({ ok: true, count: 0 })
  })

  test('AC-054.4.32: a failed call is reported, not flattened to zero', async () => {
    // This is the case that was silently true for every colleague until 0114 existed:
    // event_registration_count was never written, so the call always errored.
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'no function' } })

    expect(await loadRegistrationCount(EVENT)).toEqual({ ok: false })
  })

  test('AC-054.4.33: a non-numeric answer is treated as zero rather than rendered', async () => {
    // Boundary on the mapping: supabase-js types an rpc result as unknown, so a shape
    // change upstream must not put a string or an object into the card.
    mocks.rpc.mockResolvedValue({ data: null, error: null })

    expect(await loadRegistrationCount(EVENT)).toEqual({ ok: true, count: 0 })
  })
})