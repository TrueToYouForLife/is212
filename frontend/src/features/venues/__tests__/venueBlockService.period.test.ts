import { beforeEach, expect, test, vi } from 'vitest'
import { createVenueBlock, previewVenueBlock, listVenueBlocks } from '../venueBlockService'
import { mockQuery } from './mockQuery'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))
beforeEach(() => { mocks.rpc.mockReset(); mocks.from.mockReset() })

test('AC-012.2.32: preview/save use identical Singapore instants, normalize midnight and never send invalid periods', async () => {
  const period = { venueId: 'v1', startsOn: '2049-10-21', endsOn: '2049-10-22', startTime: '21:00', endTime: '08:00', slots: [], reason: ' Repairs ' }
  mocks.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: 'block-1', error: null })
  mocks.from.mockReturnValue(mockQuery({ count: 0, error: null }))
  expect((await previewVenueBlock(period)).ok).toBe(true)
  expect((await createVenueBlock(period)).ok).toBe(true)
  const args = { p_venue_id: 'v1', p_starts_at: '2049-10-21T13:00:00.000Z', p_ends_at: '2049-10-22T00:00:00.000Z' }
  expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'preview_venue_block_period', args)
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'block_venue_period', { ...args, p_reason: 'Repairs' })
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  await previewVenueBlock({ ...period, endsOn: period.startsOn, startTime: '23:45', endTime: '24:00' })
  expect(mocks.rpc).toHaveBeenLastCalledWith('preview_venue_block_period', { ...args, p_starts_at: '2049-10-21T15:45:00.000Z', p_ends_at: '2049-10-21T16:00:00.000Z' })
  mocks.rpc.mockClear()
  expect((await createVenueBlock({ ...period, endsOn: period.startsOn })).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
})

test('AC-012.9.26: block reads retain continuous endpoints and legacy gaps', async () => {
  const base = { id: 'b1', venue_id: 'v1', starts_on: '2049-10-21', ends_on: '2049-10-22', slots: ['T0900', 'T1200'], reason: 'Repairs', created_by_name: 'Venue Staff', created_at: '2049-01-01T00:00:00Z' }
  mocks.from.mockReturnValue(mockQuery({ data: [{ ...base, starts_at: '2049-10-21T13:00:00Z', ends_at: '2049-10-22T00:00:00Z' }, { ...base, id: 'b2', starts_at: null, ends_at: null }], error: null }))
  const result = await listVenueBlocks('v1')
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.value[0]).toMatchObject({ startsAt: '2049-10-21T13:00:00Z', endsAt: '2049-10-22T00:00:00Z' })
    expect(result.value[1].startsAt).toBeUndefined()
    expect(result.value[1].slots).toEqual(['T0900', 'T1200'])
  }
})
