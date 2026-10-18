import { beforeEach, expect, test, vi } from 'vitest'
import {
  loadOrganiserVenueArrangements, VENUE_ARRANGEMENTS_ERROR,
} from '../organiserVenueArrangementService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '42100000-0000-0000-0000-000000000001'
const arrangement = {
  booking_id: '42300000-0000-0000-0000-000000000001',
  venue_name: 'Main Hall',
  slots: [
    { date: '2042-02-10', slot: 'NIGHT', startsAt: '19:00:00', endsAt: '24:00:00', kind: 'event' },
    { date: '2042-02-11', slot: 'AM', startsAt: '07:00:00', endsAt: '12:00:00', kind: 'buffer' },
  ],
}
const failure = { ok: false, reason: VENUE_ARRANGEMENTS_ERROR }
beforeEach(() => vi.resetAllMocks())

test('AC-042.1.3: reads the selected event arrangements, preserving booked slots, midnight and empty results', async () => {
  const rows = [arrangement, {
    booking_id: '42300000-0000-0000-0000-000000000002', venue_name: 'Annex', slots: [],
  }]
  mocks.rpc.mockResolvedValue({ data: rows, error: null })
  expect(await loadOrganiserVenueArrangements(eventId)).toEqual({ ok: true, value: rows })
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
  expect(mocks.rpc).toHaveBeenCalledWith('get_organiser_venue_arrangements', { p_event_id: eventId })
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  expect(await loadOrganiserVenueArrangements(eventId)).toEqual({ ok: true, value: [] })
})

test('AC-042.1.4: invalid IDs, refused reads, malformed data and network failures never appear as no bookings', async () => {
  expect(await loadOrganiserVenueArrangements('invalid')).toEqual(failure)
  expect(mocks.rpc).not.toHaveBeenCalled()
  for (const code of ['42501', 'PGRST202', 'unknown']) {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'Private database details' } })
    expect(await loadOrganiserVenueArrangements(eventId)).toEqual(failure)
  }
  for (const data of [null, {}, [{ venue_name: 'Incomplete' }],
    [{ ...arrangement, slots: null }],
    [{ ...arrangement, slots: [{ ...arrangement.slots[0], date: '2042-02-30' }] }],
    [{ ...arrangement, slots: [{ ...arrangement.slots[0], endsAt: '24:30:00' }] }],
  ]) {
    mocks.rpc.mockResolvedValue({ data, error: null })
    expect(await loadOrganiserVenueArrangements(eventId)).toEqual(failure)
  }
  mocks.rpc.mockRejectedValue(new Error('Connection lost'))
  expect(await loadOrganiserVenueArrangements(eventId)).toEqual(failure)
})

test('AC-042.3.3: unexpected internal fields are rejected instead of forwarded to the organiser panel', async () => {
  for (const row of [
    { ...arrangement, review_note: 'Internal note' },
    { ...arrangement, slots: [{ ...arrangement.slots[0], reviewed_by: 'Staff identity' }] },
  ]) {
    mocks.rpc.mockResolvedValue({ data: [row], error: null })
    expect(await loadOrganiserVenueArrangements(eventId)).toEqual(failure)
  }
})
