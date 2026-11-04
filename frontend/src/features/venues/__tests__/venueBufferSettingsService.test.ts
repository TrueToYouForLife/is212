import { beforeEach, expect, test, vi } from 'vitest'
import { getBufferSettings, saveBufferSettings } from '../venueBufferSettingsService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
const venueId = '47000000-0000-0000-0000-000000000001'
const initial = { setupMinutes: 0, turnaroundMinutes: 15, version: 'v1' }
beforeEach(() => vi.resetAllMocks())

test('AC-047.1.8: read/save refusals distinguish stale, permission and validation errors; malformed or interrupted reads never invent settings', async () => {
  for (const [code, reason, stale] of [
    ['40001', 'This venue changed. Reload the settings before saving again.', true],
    ['42501', 'Only Venue Staff can configure setup and turnaround.', undefined],
    ['22023', 'Use non-negative multiples of 15 minutes for an active venue.', undefined],
    ['XX000', 'Venue timing settings could not be loaded or saved. Please try again.', undefined],
  ] as const) {
    const refusal = { data: null, error: { code, message: 'Private database detail' } }
    mocks.rpc.mockResolvedValueOnce(refusal).mockResolvedValueOnce(refusal)
    const expected = { ok: false, reason, ...(stale ? { stale } : {}) }
    expect(await getBufferSettings(venueId)).toEqual(expected)
    expect(await saveBufferSettings(venueId, initial)).toEqual(expected)
  }
  for (const data of [null, { ...initial, turnaroundMinutes: -15 }, { ...initial, version: '' }]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await getBufferSettings(venueId)).toEqual({ ok: false,
      reason: 'Venue timing settings could not be loaded or saved. Please try again.' })
  }
  mocks.rpc.mockRejectedValueOnce(new Error('Offline'))
  expect(await getBufferSettings(venueId)).toEqual({ ok: false,
    reason: 'Venue timing settings could not be loaded or saved. Please try again.' })
})

test('AC-047.1.9: invalid durations/version never write; zero and the integer boundary preserve independent values/version; uncertain responses never claim success', async () => {
  for (const patch of [
    { setupMinutes: -15 }, { setupMinutes: 1.5 }, { setupMinutes: 16 },
    { turnaroundMinutes: -15 }, { turnaroundMinutes: 1.5 }, { turnaroundMinutes: 16 },
    { setupMinutes: Number.NaN }, { turnaroundMinutes: Number.POSITIVE_INFINITY },
    { setupMinutes: 2147483648 }, { version: '' },
  ]) expect(await saveBufferSettings(venueId, { ...initial, ...patch })).toEqual({ ok: false,
    reason: 'Enter non-negative whole minutes in multiples of 15.' })
  expect(mocks.rpc).not.toHaveBeenCalled()

  // Largest multiple of 15 within PostgreSQL's signed integer range.
  const settings = { setupMinutes: 2147483640, turnaroundMinutes: 0, version: 'latest-version' }
  const receipt = { ...settings, version: 'saved-version', reviewCount: 0 }
  mocks.rpc.mockResolvedValueOnce({ data: receipt, error: null })
  expect(await saveBufferSettings(venueId, settings)).toEqual({ ok: true, value: receipt })
  expect(mocks.rpc).toHaveBeenLastCalledWith('update_venue_buffer_settings', {
    p_venue_id: venueId, p_version: 'latest-version', p_setup_minutes: 2147483640, p_turnaround_minutes: 0,
  })
  for (const data of [null, { ...receipt, reviewCount: -1 }, { ...receipt, reviewCount: 0.5 },
    { ...receipt, version: '' }]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await saveBufferSettings(venueId, initial)).toEqual({ ok: false,
      reason: 'Venue timing settings could not be loaded or saved. Please try again.' })
  }
  mocks.rpc.mockRejectedValueOnce(new Error('Connection lost after submit'))
  expect(await saveBufferSettings(venueId, initial)).toEqual({ ok: false,
    reason: 'Save could not be confirmed. Reload the settings before retrying.' })
})
