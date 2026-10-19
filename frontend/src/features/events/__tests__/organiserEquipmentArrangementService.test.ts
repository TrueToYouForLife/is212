import { beforeEach, expect, test, vi } from 'vitest'
import {
  loadOrganiserEquipmentArrangements, EQUIPMENT_ARRANGEMENTS_ERROR,
} from '../organiserEquipmentArrangementService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
const eventId = '42710000-0000-0000-0000-000000000001'
const row = {
  requirement_id: '42750000-0000-0000-0000-000000000001',
  equipment_name: 'Microphone', quantity_requested: 2, quantity_reserved: 2, status: 'reserved',
}
const failure = { ok: false, reason: EQUIPMENT_ARRANGEMENTS_ERROR }
beforeEach(() => vi.resetAllMocks())

test('AC-042.2.3: reads the selected event with all equipment outcomes, quantities and empty results', async () => {
  const rows = [row, ...['partially_reserved', 'unavailable', 'pending_review'].map((status, i) => ({
    ...row, requirement_id: `42750000-0000-0000-0000-00000000000${i + 2}`,
    status, quantity_reserved: status === 'partially_reserved' ? 1 : 0,
  }))]
  mocks.rpc.mockResolvedValue({ data: rows, error: null })
  expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual({ ok: true, value: rows })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(mocks.rpc).toHaveBeenCalledWith('get_organiser_equipment_arrangements', { p_event_id: eventId })
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual({ ok: true, value: [] })
})

test('AC-042.2.4: invalid IDs, read failures and malformed responses produce an error rather than no equipment', async () => {
  expect(await loadOrganiserEquipmentArrangements('invalid')).toEqual(failure)
  expect(mocks.rpc).not.toHaveBeenCalled()
  for (const code of ['42501', 'PGRST202', 'unknown']) {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'Private database details' } })
    expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual(failure)
  }
  for (const data of [null, {}, [{}],
    [{ ...row, requirement_id: 'invalid' }], [{ ...row, equipment_name: ' ' }],
    [{ ...row, status: 'unknown' }], [{ ...row, quantity_requested: 0 }],
    [{ ...row, quantity_requested: 1.5 }], [{ ...row, quantity_reserved: -1 }],
    [{ ...row, quantity_reserved: 0.5 }], [{ ...row, quantity_reserved: 3 }],
    [{ ...row, quantity_reserved: '2' }],
  ]) {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual(failure)
  }
  mocks.rpc.mockRejectedValue(new Error('Connection lost'))
  expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual(failure)
})

test('AC-042.3.7: rejects unexpected staff notes, allocations and audit fields', async () => {
  for (const internal of [
    { technical_notes: 'Private instructions' }, { allocations: [{ asset_tag: 'UNIT-1' }] },
    { assessed_by: 'Staff identity' }, { safety_review_comments: 'Private review' },
    { audit: [{ changed_by: 'Staff identity' }] },
  ]) {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, ...internal }], error: null })
    expect(await loadOrganiserEquipmentArrangements(eventId)).toEqual(failure)
  }
})
