import { beforeEach, expect, test, vi } from 'vitest'
import { loadEquipmentReturns, saveReturnInspection, EQUIPMENT_RETURN_MESSAGES as messages } from '../equipmentReturnService'
import { inspectionResultingStatus, returnInspectionInput } from '../equipmentReturnValidation'
import { equipmentStatusTargets } from '../equipmentStatusValidation'
import { allocation, inspectionInput as input, inspectionReceipt, returnsData, returnId } from './fixtures/equipmentReturns'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
beforeEach(() => vi.resetAllMocks())

test('AC-024.1.11: reads the protected return lists, including valid empty lists and allocation-specific history', async () => {
  for (const data of [returnsData(), { out: [], pendingChecks: [], history: [] }]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await loadEquipmentReturns()).toEqual({ ok: true, data })
    expect(mocks.rpc).toHaveBeenLastCalledWith('get_equipment_return_inspections')
  }
})

test('AC-024.1.12: malformed, ambiguous, failed or interrupted lists cannot become false empty success', async () => {
  const valid = returnsData()
  for (const data of [null, {}, { ...valid, history: null },
    { ...valid, pendingChecks: [allocation, allocation] },
    { ...valid, out: [allocation] },
    { ...valid, pendingChecks: [{ ...allocation, returnDate: '2026-02-30' }] },
    { ...valid, pendingChecks: [{ ...allocation, collectionDate: '2026-11-01' }] },
    { ...valid, pendingChecks: [{ ...allocation, allocationStatus: 'cancelled' }] },
    { ...valid, pendingChecks: [{ ...allocation, lastFinding: 'missing' }] },
    { ...valid, history: [{ ...valid.history[0], finding: 'damage', defectReportId: null }] },
    { ...valid, history: [valid.history[0], valid.history[0]] },
  ]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await loadEquipmentReturns()).toEqual({ ok: false, reason: messages.load })
  }
  mocks.rpc.mockResolvedValueOnce({ data: valid, error: { code: 'XX000' } })
  expect(await loadEquipmentReturns()).toEqual({ ok: false, reason: messages.load })
  mocks.rpc.mockRejectedValueOnce(new Error('offline'))
  expect(await loadEquipmentReturns()).toEqual({ ok: false, reason: messages.load })
})

test('AC-024.2.5: validates each finding, keeps legacy/current status by default and requires reasons for issues or explicit changes', () => {
  for (const finding of ['defect', 'damage', 'other'] as const) {
    for (const targetStatus of equipmentStatusTargets) {
      expect(returnInspectionInput.parse({ ...input, finding, targetStatus }).description).toBe('Cracked lens')
    }
  }
  for (const currentStatus of ['needs_repair', 'retired', 'missing'] as const) {
    const value = returnInspectionInput.parse({ ...input, finding: 'good', currentStatus, targetStatus: '', description: '' })
    expect(inspectionResultingStatus(value)).toBe(currentStatus)
  }
  const missing = returnInspectionInput.parse({ ...input, finding: 'missing', targetStatus: '' })
  expect(inspectionResultingStatus(missing)).toBe('unavailable')
  expect(returnInspectionInput.safeParse({ ...input, finding: 'good', targetStatus: 'operational', description: '' }).success).toBe(true)
  for (const invalid of [{ description: '  ' }, { finding: '' }, { targetStatus: '' }, { targetStatus: 'retired' },
    { finding: 'good', description: '' }, { finding: 'missing', targetStatus: 'operational' },
    { allocationId: 'bad' }, { version: '' }, { statusVersion: -1 }, { statusVersion: 0.5 },
    { statusVersion: Number.MAX_SAFE_INTEGER + 1 }]) {
    expect(returnInspectionInput.safeParse({ ...input, ...invalid }).success).toBe(false)
  }
})

test('AC-024.2.6: sends only allocation, displayed consent, findings and chosen status; accepts no-change, legacy and missing receipts', async () => {
  const scenarios = [input,
    { ...input, finding: 'good' as const, description: '', targetStatus: '' as const, currentStatus: 'retired' as const },
    { ...input, finding: 'missing' as const, targetStatus: '' as const },
    { ...input, finding: 'defect' as const, currentStatus: 'needs_repair' as const },
  ]
  for (const value of scenarios) {
    const target = inspectionResultingStatus(value), changed = target !== value.currentStatus
    const data = inspectionReceipt({ finding: value.finding, resolved: value.finding !== 'missing', status: target,
      statusVersion: changed ? 1 : 0, statusChanged: changed, reviewCount: changed ? 1 : 0 })
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await saveReturnInspection(value)).toEqual({ ok: true, data })
    expect(mocks.rpc).toHaveBeenLastCalledWith('inspect_equipment_return', {
      p_allocation: value.allocationId, p_version: value.version, p_finding: value.finding,
      p_description: value.description.trim() || null,
      p_status: value.finding === 'missing' ? 'unavailable' : value.targetStatus || null,
    })
  }
})

test('AC-024.2.7: invalid inputs never send and mismatched or uncertain save receipts cannot report success', async () => {
  expect((await saveReturnInspection({ ...input, description: '' })).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
  for (const data of [null, {}, inspectionReceipt({ allocationId: returnId(99) }), inspectionReceipt({ finding: 'other' }),
    inspectionReceipt({ resolved: false }), inspectionReceipt({ status: 'operational' }), inspectionReceipt({ statusVersion: 0 }),
    inspectionReceipt({ statusChanged: false }), inspectionReceipt({ inspectionVersion: 0 }),
  ]) {
    mocks.rpc.mockResolvedValueOnce({ data, error: null })
    expect(await saveReturnInspection(input)).toEqual({ ok: false, reason: messages.failed })
  }
  mocks.rpc.mockRejectedValueOnce(new Error('response lost'))
  expect(await saveReturnInspection(input)).toEqual({ ok: false, reason: messages.failed })
})

test('AC-024.3.10: role, stale, ineligible and uncertain outcomes have safe messages rather than database details', async () => {
  for (const [code, reason] of [['42501', messages.forbidden], ['40001', messages.stale], ['22023', messages.ineligible], ['XX000', messages.failed]]) {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: 'private database detail' } })
    expect(await saveReturnInspection(input)).toEqual({ ok: false, reason })
  }
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  expect(await loadEquipmentReturns()).toEqual({ ok: false, reason: messages.forbidden })
})
