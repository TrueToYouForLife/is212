import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { equipmentStatusInput, equipmentStatusTargets, type EquipmentStatusInput } from '../equipmentStatusValidation'
import { EQUIPMENT_STATUS_MESSAGES as messages, EQUIPMENT_STATUS_SAVE_TIMEOUT_MS, loadEquipmentStatus, saveEquipmentStatus } from '../equipmentStatusService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => {
  const request = mocks.rpc(...args)
  return Object.assign(request, { abortSignal: (signal: AbortSignal) => {
    request.signal = signal
    return request
  } })
} } }))
const itemId = 'a1050000-0000-0000-0004-000000000001'
const input: EquipmentStatusInput = { itemId, status: 'needs_repair', note: '  Lamp failed  ', version: 3 }
const details = { id: itemId, assetTag: 'P-1', status: 'missing', version: 3, history: [{
  id: 'a1050000-0000-0000-0010-000000000001', previousStatus: 'operational', newStatus: 'needs_repair',
  note: 'Old repair', changedBy: 'a1050000-0000-0000-0001-000000000001', changedByName: 'Staff',
  changedAt: '2026-10-23T03:00:00+00:00', version: 1,
}] }
beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.useRealTimers())

test('AC-027.5.4: accepts the four targets and trimmed notes; rejects blank notes, unsupported states and invalid loaded versions', () => {
  for (const status of equipmentStatusTargets) {
    expect(equipmentStatusInput.parse({ ...input, status }).note).toBe('Lamp failed')
  }
  for (const invalid of [
    { note: ' \n ' }, { status: '' }, { status: 'retired' }, { status: 'missing' }, { itemId: 'not-a-uuid' },
    { version: -1 }, { version: 0.5 }, { version: Number.NaN }, { version: Number.MAX_SAFE_INTEGER + 1 },
  ]) expect(equipmentStatusInput.safeParse({ ...input, ...invalid }).success).toBe(false)
  expect(equipmentStatusInput.safeParse({ ...input, version: 0 }).success).toBe(true)
})

test('AC-027.5.5: reads versioned history and saves only unit, target, trimmed note and the displayed version; accepts confirmed no-op', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: details, error: null })
  expect(await loadEquipmentStatus(itemId)).toEqual({ ok: true, data: details })
  expect(mocks.rpc).toHaveBeenLastCalledWith('get_equipment_status', { p_item: itemId })
  for (const changed of [true, false]) {
    const data = { id: itemId, version: changed ? 4 : 3, changed, reviewCount: changed ? 2 : 0 }
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await saveEquipmentStatus(input)).toEqual({ ok: true, data })
    expect(mocks.rpc).toHaveBeenLastCalledWith('set_equipment_status', {
      p_item: itemId, p_status: 'needs_repair', p_note: 'Lamp failed', p_version: 3,
    })
  }
})

test('AC-027.5.6: invalid inputs never send; malformed, wrong-unit or interrupted responses cannot report success or empty history', async () => {
  expect((await saveEquipmentStatus({ ...input, note: ' ' })).ok).toBe(false)
  expect((await loadEquipmentStatus('bad')).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
  for (const data of [null, { ...details, history: null }, { ...details, id: 'a1050000-0000-0000-0004-000000000002' }]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await loadEquipmentStatus(itemId)).toEqual({ ok: false, reason: messages.load })
  }
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } })
  expect((await loadEquipmentStatus(itemId)).ok).toBe(false)
  mocks.rpc.mockRejectedValueOnce(new Error('offline'))
  expect(await loadEquipmentStatus(itemId)).toEqual({ ok: false, reason: messages.load })
  for (const data of [null, { id: itemId, version: 3, changed: true, reviewCount: 1 },
    { id: 'a1050000-0000-0000-0004-000000000002', version: 4, changed: true, reviewCount: 0 }]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await saveEquipmentStatus(input)).toEqual({ ok: false, reason: messages.failed })
  }
  mocks.rpc.mockRejectedValueOnce(new Error('connection lost'))
  expect(await saveEquipmentStatus(input)).toEqual({ ok: false, reason: messages.failed })
})

test('AC-027.8.6: explains permission refusal, stale edits, validation and uncertain database outcomes without exposing internal errors', async () => {
  for (const [code, reason] of [['42501', messages.forbidden], ['40001', messages.stale], ['22023', messages.invalid], ['XX000', messages.failed]]) {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'private database detail' } })
    expect(await saveEquipmentStatus(input)).toEqual({ ok: false, reason })
  }
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  expect(await loadEquipmentStatus(itemId)).toEqual({ ok: false, reason: messages.forbidden })
})

test('AC-027.8.10: a stalled save has a bounded unknown outcome, aborts without retrying and ignores a late success; timely stale refusal still wins', async () => {
  vi.useFakeTimers()
  let finish!: (response: unknown) => void
  const stalled = new Promise((resolve) => { finish = resolve })
  mocks.rpc.mockReturnValueOnce(stalled)
  const result = saveEquipmentStatus(input)
  const received = vi.fn()
  void result.then(received)
  await vi.advanceTimersByTimeAsync(EQUIPMENT_STATUS_SAVE_TIMEOUT_MS - 1)
  expect(received).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(await result).toEqual({ ok: false, reason: messages.timeout })
  expect((stalled as Promise<unknown> & { signal: AbortSignal }).signal.aborted).toBe(true)
  finish({ data: { id: itemId, version: 4, changed: true, reviewCount: 0 }, error: null })
  await vi.advanceTimersByTimeAsync(0)
  expect(received).toHaveBeenCalledTimes(1)
  expect(received).toHaveBeenCalledWith({ ok: false, reason: messages.timeout })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)

  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } })
  expect(await saveEquipmentStatus(input)).toEqual({ ok: false, reason: messages.stale })
  expect(vi.getTimerCount()).toBe(0)
})
