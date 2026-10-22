import { beforeEach, describe, expect, test, vi } from 'vitest'
import { previewVenueBlock, VENUE_BLOCK_MESSAGES } from '../venueBlockService'
import { BLOCK_VALIDATION_MESSAGES } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, rpc: mocks.rpc, from: mocks.from } }))

const valid: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-11',
  slots: ['T0900', 'T1300'],
  reason: 'Repairs',
}

const row = (overrides: Record<string, unknown>) => ({
  overlap_type: 'booking',
  booking_id: null,
  booking_status: null,
  event_reference: null,
  event_name: null,
  slot_date: '2040-03-10',
  slot: 'T0900',
  claim_kind: 'event',
  block_reason: null,
  ...overrides,
})

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
})

describe('AC-012.7 — previewing a block before saving', () => {
  test('AC-012.7.9: preview sends the block\u2019s dates and slots, and groups what it overlaps by booking', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        row({ booking_id: 'b1', booking_status: 'confirmed', event_reference: 'EVT-1', event_name: 'Gala' }),
        row({ overlap_type: 'existing_block', slot: 'T1300', claim_kind: 'maintenance', block_reason: 'Deep clean' }),
        row({ booking_id: 'b1', booking_status: 'confirmed', event_reference: 'EVT-1', event_name: 'Gala',
              slot: 'T1300', claim_kind: 'buffer' }),
      ],
      error: null,
    })

    const result = await previewVenueBlock(valid)

    expect(mocks.rpc).toHaveBeenCalledWith('preview_venue_block', {
      p_venue_id: 'v1',
      p_starts_on: '2040-03-10',
      p_ends_on: '2040-03-11',
      p_slots: ['T0900', 'T1300'],
    })
    expect(result).toStrictEqual({
      ok: true,
      value: {
        affectedBookings: [{
          bookingId: 'b1', status: 'confirmed', eventReference: 'EVT-1', eventName: 'Gala',
          cells: [
            { date: '2040-03-10', slot: 'T0900', kind: 'event' },
            { date: '2040-03-10', slot: 'T1300', kind: 'buffer' },
          ],
        }],
        existingBlocks: [{ date: '2040-03-10', slot: 'T1300', reason: 'Deep clean' }],
      },
    })
  })

  test('AC-012.7.10: an invalid block is not previewed', async () => {
    expect(await previewVenueBlock({ ...valid, endsOn: '2040-03-09' })).toStrictEqual({
      ok: false,
      reason: BLOCK_VALIDATION_MESSAGES.endBeforeStart,
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-012.7.11: a preview the database refuses is explained the same way as saving', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    expect(await previewVenueBlock(valid)).toStrictEqual({ ok: false, reason: VENUE_BLOCK_MESSAGES.notPermitted })
  })
})
