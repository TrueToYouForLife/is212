import { beforeEach, expect, test, vi } from 'vitest'
import { getVenueReplacements, proposeVenueReplacement, decideVenueReplacement, REPLACEMENT_MESSAGES } from '../venueReplacementService'
import { replacementFixture, replacementIds as ids } from './venueReplacementFixtures'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
beforeEach(() => vi.resetAllMocks())
test('AC-020.3.30: loads proposals and retained history with validated current versions', async () => {
  mocks.rpc.mockResolvedValue({ data: replacementFixture, error: null })
  expect(await getVenueReplacements()).toEqual({ ok: true, value: replacementFixture })
  expect(mocks.rpc).toHaveBeenCalledWith('get_venue_replacements')
})
test('AC-020.3.31: malformed data, denied reads and offline reads fail instead of showing empty history', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ error: { code: '42501' } }).mockRejectedValueOnce(new Error('offline'))
  for (let i = 0; i < 3; i++) expect(await getVenueReplacements()).toEqual({ ok: false, reason: REPLACEMENT_MESSAGES.load })
})
test('AC-020.3.32: proposal sends original booking, selected alternative and trimmed reason with source version', async () => {
  mocks.rpc.mockResolvedValue({ data: ids.request, error: null })
  expect(await proposeVenueReplacement(ids.source, ids.target, 'v1', ' Agreed alternative ')).toEqual({ ok: true })
  expect(mocks.rpc).toHaveBeenCalledWith('propose_venue_replacement', {
    p_booking: ids.source, p_target: ids.target, p_version: 'v1', p_reason: 'Agreed alternative',
  })
})
test('AC-020.3.33: incomplete and invalid proposals are rejected before RPC', async () => {
  for (const input of [['bad', ids.target, 'v', 'note'], [ids.source, 'bad', 'v', 'note'], [ids.source, ids.target, '', 'note'], [ids.source, ids.target, 'v', ' ']]) {
    expect(await proposeVenueReplacement(input[0], input[1], input[2], input[3])).toEqual({ ok: false, reason: REPLACEMENT_MESSAGES.invalid })
  }
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-020.3.34: review decisions carry expected version and note without trusting a client-supplied reviewer', async () => {
  mocks.rpc.mockResolvedValue({ data: ids.request, error: null })
  expect(await decideVenueReplacement(ids.request, 'review-v1', 'approved', ' Checked ')).toEqual({ ok: true })
  expect(mocks.rpc).toHaveBeenCalledWith('decide_venue_replacement', {
    p_request: ids.request, p_version: 'review-v1', p_decision: 'approved', p_note: 'Checked',
  })
})
test('AC-020.3.35: invalid decisions and missing notes or versions never call the database', async () => {
  expect((await decideVenueReplacement('bad', 'v', 'approved', 'note')).ok).toBe(false)
  expect((await decideVenueReplacement(ids.request, '', 'approved', 'note')).ok).toBe(false)
  expect((await decideVenueReplacement(ids.request, 'v', 'rejected', ' ')).ok).toBe(false)
  // A runtime value can still reach JavaScript despite the TypeScript union.
  expect((await decideVenueReplacement(ids.request, 'v', 'unknown' as 'approved', 'note')).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-020.3.36: permission, stale, conflict and eligibility failures remain actionable', async () => {
  for (const [code, key] of [['42501', 'forbidden'], ['40001', 'stale'], ['23505', 'conflict'], ['23514', 'conflict'], ['22023', 'ineligible'], ['XX000', 'failed']] as const) {
    mocks.rpc.mockResolvedValue({ error: { code, message: 'private details' } })
    expect(await decideVenueReplacement(ids.request, 'v', 'approved', 'note')).toEqual({ ok: false, reason: REPLACEMENT_MESSAGES[key] })
  }
})
test('AC-020.3.37: lost responses and malformed successes require reload without automatic retry', async () => {
  mocks.rpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: null })
  expect(await decideVenueReplacement(ids.request, 'v', 'withdrawn', 'note')).toEqual({ ok: false, reason: REPLACEMENT_MESSAGES.failed })
  expect(await decideVenueReplacement(ids.request, 'v', 'withdrawn', 'note')).toEqual({ ok: false, reason: REPLACEMENT_MESSAGES.failed })
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})
