import { beforeEach, expect, test, vi } from 'vitest'
import { CATALOGUE_LOAD_ERROR, loadEquipmentCatalogue } from '../equipmentCatalogueService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
beforeEach(() => vi.resetAllMocks())

test('AC-027.1.2: loads the catalogue through the read-only operation, including empty stock', async () => {
  const data = { types: [], units: [] }
  mocks.rpc.mockResolvedValue({ data, error: null })
  expect(await loadEquipmentCatalogue()).toEqual({ ok: true, data })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(mocks.rpc).toHaveBeenCalledWith('get_equipment_catalogue')
})

test('AC-027.1.3: refused, malformed and interrupted loads are errors rather than empty catalogues', async () => {
  for (const result of [
    { data: null, error: { code: '42501', message: 'private detail' } },
    { data: { types: [], units: [{ id: 'incomplete' }] }, error: null },
    { data: null, error: null },
  ]) {
    mocks.rpc.mockResolvedValueOnce(result)
    expect(await loadEquipmentCatalogue()).toEqual({ ok: false, reason: CATALOGUE_LOAD_ERROR })
  }
  mocks.rpc.mockRejectedValueOnce(new Error('offline'))
  expect(await loadEquipmentCatalogue()).toEqual({ ok: false, reason: CATALOGUE_LOAD_ERROR })
})
