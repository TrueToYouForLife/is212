import { beforeEach, expect, test, vi } from 'vitest'
import { listVenueDecisionNotifications } from '../venueDecisionNotificationService'
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), order: vi.fn(), limit: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.from.mockReturnValue(mocks); mocks.select.mockReturnValue(mocks); mocks.order.mockReturnValue(mocks)
})
test('AC-010.14.20: reads at most 50 newest notices with a stable tie-breaker and no browser-chosen recipient', async () => {
  const notifications = [{ id: 'notice', decision: 'confirmed' }]
  mocks.limit.mockResolvedValue({ data: notifications, error: null })
  expect(await listVenueDecisionNotifications()).toEqual({ ok: true, notifications })
  expect(mocks.from).toHaveBeenCalledWith('venue_booking_decision_notifications')
  expect(mocks.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]])
  expect(mocks.limit).toHaveBeenCalledWith(50)
})
test('AC-010.14.21: empty successful reads give an empty list', async () => {
  mocks.limit.mockResolvedValue({ data: null, error: null })
  expect(await listVenueDecisionNotifications()).toEqual({ ok: true, notifications: [] })
})
test('AC-010.14.22: a database error is not an empty successful inbox', async () => {
  mocks.limit.mockResolvedValue({ data: null, error: { message: 'private detail' } })
  const result = await listVenueDecisionNotifications()
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('private detail')
})
test('AC-010.14.23: an interrupted read produces an error without retry', async () => {
  mocks.limit.mockRejectedValue(new Error('offline'))
  expect((await listVenueDecisionNotifications()).ok).toBe(false)
  expect(mocks.limit).toHaveBeenCalledOnce()
})
