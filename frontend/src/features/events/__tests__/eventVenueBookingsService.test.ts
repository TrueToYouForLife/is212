import { expect, test, vi } from 'vitest'
import { loadEventVenueBookings, EVENT_VENUES_ERROR } from '../eventVenueBookingsService'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }))
test('AC-049.5.33: event summary calls the checked RPC and accepts an empty list', async () => {
  rpc.mockResolvedValue({ data: [], error: null })
  expect(await loadEventVenueBookings('e1')).toEqual({ ok: true, value: [] })
  expect(rpc).toHaveBeenCalledWith('get_event_venue_bookings', { p_event_id: 'e1' })
})
test('AC-049.5.34: denied, malformed, null and network responses never become an empty success', async () => {
  for (const response of [{ error: { code:'42501' } }, { data: [{}] }, { data:null }]) {
    rpc.mockResolvedValue(response)
    expect(await loadEventVenueBookings('e1')).toEqual({ ok:false, reason:EVENT_VENUES_ERROR })
  }
  rpc.mockRejectedValue(new Error('offline'))
  expect(await loadEventVenueBookings('e1')).toEqual({ ok:false, reason:EVENT_VENUES_ERROR })
})
