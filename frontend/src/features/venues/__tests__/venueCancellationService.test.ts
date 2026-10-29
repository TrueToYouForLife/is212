import { expect, test, vi } from 'vitest'
import { cancelVenueBooking, getVenueCancellation } from '../venueCancellationService'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase', () => ({ supabase:{ rpc } }))
test('AC-049.7.33: blank reason performs no request and valid reason sends exact booking and consent version', async () => {
  rpc.mockClear()
  expect((await cancelVenueBooking('b1','  ','v1')).ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data:'b1',error:null })
  expect((await cancelVenueBooking('b1',' why ','v1')).ok).toBe(true)
  expect(rpc).toHaveBeenCalledWith('cancel_individual_venue_booking',{p_booking_id:'b1',p_reason:'why',p_expected_version:'v1'})
})
test('AC-049.7.34: malformed, refused and network results fail closed', async () => {
  rpc.mockResolvedValue({data:{},error:null})
  expect(await getVenueCancellation('b1')).toBeNull()
  rpc.mockResolvedValue({data:'wrong-booking',error:null})
  expect((await cancelVenueBooking('b1','why','v1')).ok).toBe(false)
  rpc.mockRejectedValue(new Error('offline'))
  expect(await getVenueCancellation('b1')).toBeNull()
  expect((await cancelVenueBooking('b1','why','v1')).ok).toBe(false)
})
