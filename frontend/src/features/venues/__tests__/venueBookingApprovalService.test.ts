import { beforeEach, expect, test, vi } from 'vitest'
import { approveVenueBooking } from '../venueBookingApprovalService'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc } }))
beforeEach(() => { vi.clearAllMocks() })

test('AC-010.5.16: approval sends only booking identity and the reviewed version', async () => {
  rpc.mockResolvedValue({ data: 'booking-1', error: null })
  expect(await approveVenueBooking('booking-1', 'version-1')).toEqual({ ok: true })
  expect(rpc).toHaveBeenCalledWith('approve_venue_booking', { p_booking_id: 'booking-1', p_expected_version: 'version-1' })
})
test('AC-010.11.4: missing version is refused without database access', async () => {
  expect((await approveVenueBooking('booking-1', '')).ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})
test('AC-010.11.5: database refusal is surfaced without exposing internal details', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'private error' } })
  const result = await approveVenueBooking('booking-1', 'old-version')
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('private error')
})
test('AC-010.12.19: an unexpected success payload is not treated as approval', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  expect((await approveVenueBooking('booking-1', 'version-1')).ok).toBe(false)
})
test('AC-010.12.20: interrupted approval requires reload and is never retried automatically', async () => {
  rpc.mockRejectedValue(new Error('network'))
  expect(await approveVenueBooking('booking-1', 'version-1')).toMatchObject({ ok: false, reason: expect.stringContaining('Reload') })
  expect(rpc).toHaveBeenCalledOnce()
})
