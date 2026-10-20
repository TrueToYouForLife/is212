import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createVenueBlock, VENUE_BLOCK_MESSAGES } from '../venueBlockService'
import { BLOCK_VALIDATION_MESSAGES } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'
import { mockQuery } from './mockQuery'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))

const valid: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-10',
  slots: ['T0900'],
  reason: 'Repairs',
}

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

describe('saving a block', () => {
  test('AC-012.3.6: the reason is sent trimmed, with the argument names block_venue expects', async () => {
    mocks.rpc.mockResolvedValue({ data: 'block-1', error: null })
    mocks.from.mockReturnValue(mockQuery({ count: 0, error: null }))

    await createVenueBlock({ ...valid, reason: '  Repairs  ' })

    expect(mocks.rpc).toHaveBeenCalledWith('block_venue', {
      p_venue_id: 'v1',
      p_starts_on: '2040-03-10',
      p_ends_on: '2040-03-10',
      p_slots: ['T0900'],
      p_reason: 'Repairs',
    })
  })

  test('AC-012.8.14: the number of bookings the block flagged is read back from the database', async () => {
    const flags = mockQuery({ count: 2, error: null })
    mocks.rpc.mockResolvedValue({ data: 'block-1', error: null })
    mocks.from.mockReturnValue(flags)

    const result = await createVenueBlock(valid)

    expect(result).toStrictEqual({ ok: true, value: { blockId: 'block-1', flaggedBookings: 2 } })
    expect(mocks.from).toHaveBeenCalledWith('venue_booking_flags')
    expect(flags.eq).toHaveBeenCalledWith('closure_id', 'block-1')
  })

  test('AC-012.8.15: if the flag count cannot be read, the block is still reported saved, with the count unknown', async () => {
    mocks.rpc.mockResolvedValue({ data: 'block-1', error: null })
    mocks.from.mockReturnValue(mockQuery({ count: null, error: { message: 'timeout' } }))

    expect(await createVenueBlock(valid)).toStrictEqual({
      ok: true,
      value: { blockId: 'block-1', flaggedBookings: null },
    })
  })

  test('AC-012.2.21: an invalid block is refused without calling the database', async () => {
    expect(await createVenueBlock({ ...valid, reason: ' ' })).toStrictEqual({
      ok: false,
      reason: BLOCK_VALIDATION_MESSAGES.reasonRequired,
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('saving a block — each problem is explained', () => {
  const failWith = (code: string, message = 'database message') =>
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } })

  test('AC-012.1.8: a refusal because the user is not Venue Staff says so', async () => {
    failWith('42501')
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.notPermitted })
  })

  test('AC-012.9.12: an overlap with an existing block says to remove or change that block', async () => {
    failWith('23505')
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.overlapsBlock })
  })

  test('AC-012.2.22: a rule the database refuses shows the database\u2019s own sentence', async () => {
    failWith('22023', 'A retired venue cannot be blocked')
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: 'A retired venue cannot be blocked' })
  })

  test('AC-012.2.23: a venue that no longer exists says so', async () => {
    failWith('P0002')
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.notFound })
  })

  test('AC-012.2.24: a lost reply says the save could not be confirmed, since it may have gone through', async () => {
    mocks.rpc.mockRejectedValue(new Error('network down'))
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.uncertain })
  })

  test('AC-012.2.25: any other error says nothing was changed', async () => {
    failWith('57014')
    expect(await createVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.unexpected })
  })
})
