import { beforeEach, expect, test, vi } from 'vitest'
import { holdVenue, loadTimeSlots, VENUE_BOOKING_MESSAGES as messages } from '../venueBookingService'
import { createSupabaseFake, APPROVED_EVENT, COORDINATOR_ID, EVENT_ID, VENUE_ID, BOOKING_ID } from './fixtures/venueBooking'
import { QUARTER_HOUR_SLOTS } from '../quarterHourSlots'
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, auth: { getUser: mocks.getUser } } }))
const fake = createSupabaseFake()
function plan(event: Record<string, unknown> = APPROVED_EVENT, setup = 30) {
  fake.plan('events', { data: event })
  fake.plan('venues', { data: { setup_minutes: setup, turnaround_minutes: 45 } })
}
beforeEach(() => {
  vi.resetAllMocks(); fake.reset()
  mocks.from.mockImplementation(fake.route)
  mocks.getUser.mockResolvedValue({ data: { user: { id: COORDINATOR_ID } }, error: null })
  mocks.rpc.mockResolvedValue({ data: BOOKING_ID, error: null })
})
test('AC-047.2.39: hold saves only through the atomic RPC, with server default or explicit duration', async () => {
  plan()
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: true, bookingId: BOOKING_ID })
  expect(mocks.rpc).toHaveBeenLastCalledWith('hold_venue', { p_event_id: EVENT_ID, p_venue_id: VENUE_ID })
  plan()
  await holdVenue(EVENT_ID, VENUE_ID, 2)
  expect(mocks.rpc).toHaveBeenLastCalledWith('hold_venue', { p_event_id: EVENT_ID, p_venue_id: VENUE_ID, p_hold_days: 2 })
  expect(fake.tablesTouched()).not.toContain('venue_bookings')
  expect(fake.tablesTouched()).not.toContain('venue_effective_slot_claims')
})
test('AC-047.2.40: assignment, lifecycle, missing timing and invalid durations prevent writes', async () => {
  for (const change of [{ coordinator_id: null }, { coordinator_id: 'other' }, ...['draft', 'submitted', 'under_review', 'confirmed', 'completed', 'cancelled', 'rejected'].map((status) => ({ status })), { proposed_start: null }, { proposed_end: null }]) {
    plan({ ...APPROVED_EVENT, ...change })
    expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
  }
  plan(APPROVED_EVENT, 10)
  expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await holdVenue(EVENT_ID, VENUE_ID)).ok).toBe(false)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-047.2.41: database conflicts and permission refusals stay refused; lost replies never invite blind retries', async () => {
  plan()
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505' } })
  fake.plan('venue_effective_slot_claims', { data: [] })
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: false, reason: messages.unavailable, conflicts: [] })
  plan()
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: false, reason: messages.rlsDenied, conflicts: [] })
  plan()
  mocks.rpc.mockRejectedValueOnce(new Error('Network lost after save'))
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: false, reason: messages.uncertain, conflicts: [] })
  plan()
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: false, reason: messages.uncertain, conflicts: [] })
})
test('AC-047.2.42: catalogue reads preserve every quarter-hour boundary including 24:00', async () => {
  fake.plan('time_slots', { data: QUARTER_HOUR_SLOTS.map((slot) => ({ code: slot.code, starts_at: slot.startsAt, ends_at: slot.endsAt, sort_order: slot.sortOrder })) })
  expect(await loadTimeSlots()).toEqual(QUARTER_HOUR_SLOTS)
})

test('AC-047.2.43: conflict details use venue-specific occupied cells and survive a failed detail read', async () => {
  // Fixture event is 09:00–11:00 SGT; 30-minute setup starts at 08:30.
  plan()
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505' } })
  fake.plan('venue_effective_slot_claims', { data: [
    { slot_date: '2026-10-12', slot: 'T0830', kind: 'maintenance' },
    { slot_date: '2026-10-12', slot: 'T1145', kind: 'event' },
  ] })
  const result = await holdVenue(EVENT_ID, VENUE_ID)
  expect(result.ok ? [] : result.conflicts).toEqual([{ date: '2026-10-12', slot: 'T0830', kind: 'maintenance' }])
  expect(result.ok ? '' : result.reason).toContain('08:30–08:45')
  plan()
  fake.plan('venue_effective_slot_claims', { error: { message: 'failed' } })
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await holdVenue(EVENT_ID, VENUE_ID)).toEqual({ ok: false, reason: messages.unavailable, conflicts: [] })
  errorLog.mockRestore()
})
