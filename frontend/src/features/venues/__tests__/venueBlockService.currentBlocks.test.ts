import { beforeEach, describe, expect, test, vi } from 'vitest'
import { listVenueBlocks, removeVenueBlock, VENUE_BLOCK_MESSAGES } from '../venueBlockService'
import { mockQuery } from './mockQuery'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))

const blockRow = {
  id: 'block-1',
  venue_id: 'v1',
  starts_on: '2040-03-10',
  ends_on: '2040-03-12',
  slots: ['T0900', 'T1300', 'T2345'],
  reason: 'Ceiling repair',
  created_by_name: 'Vera Venue',
  created_at: '2040-01-05T02:00:00+00:00',
}

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

describe('AC-012.9 — current blocks can be viewed and removed', () => {
  test('AC-012.9.13: the current blocks for a venue leave out removed ones, earliest first', async () => {
    const query = mockQuery({ data: [blockRow], error: null })
    mocks.from.mockReturnValue(query)

    await listVenueBlocks('v1')

    expect(mocks.from).toHaveBeenCalledWith('venue_closures')
    expect(query.eq).toHaveBeenCalledWith('venue_id', 'v1')
    expect(query.is).toHaveBeenCalledWith('removed_at', null)
    expect(query.order).toHaveBeenCalledWith('starts_on')
  })

  test('AC-012.9.14: if the blocks cannot be loaded, the user is told', async () => {
    mocks.from.mockReturnValue(mockQuery({ data: null, error: { message: 'timeout' } }))
    expect(await listVenueBlocks('v1')).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.loadFailed })
  })

  test('AC-012.9.15: removing a block sends its id to remove_venue_block', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })

    expect(await removeVenueBlock('block-1')).toStrictEqual({ ok: true, value: null })
    expect(mocks.rpc).toHaveBeenCalledWith('remove_venue_block', { p_closure_id: 'block-1' })
  })

  test('AC-012.9.16: removing a block that is already gone says to reload', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'gone' } })
    expect(await removeVenueBlock('block-1')).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.notFound })
  })
})

describe('AC-012.10 — who blocked, and when', () => {
  test('AC-012.10.5: each current block carries who created it and when', async () => {
    mocks.from.mockReturnValue(mockQuery({ data: [blockRow], error: null }))

    expect(await listVenueBlocks('v1')).toStrictEqual({
      ok: true,
      value: [{
        id: 'block-1',
        venueId: 'v1',
        startsOn: '2040-03-10',
        endsOn: '2040-03-12',
        slots: ['T0900', 'T1300', 'T2345'],
        reason: 'Ceiling repair',
        createdByName: 'Vera Venue',
        createdAt: '2040-01-05T02:00:00+00:00',
      }],
    })
  })
})
