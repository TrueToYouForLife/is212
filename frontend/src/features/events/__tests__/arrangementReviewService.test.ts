import { beforeEach, expect, test, vi } from 'vitest'
import { ARRANGEMENT_REVIEW_ERROR, listArrangementReviews, listArrangementReviewCounts } from '../arrangementReviewService'
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from } }))
const eventId = '41100000-0000-0000-0000-000000000001'
function query(data: unknown, error: unknown = null) {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
  q.order.mockReturnValueOnce(q).mockResolvedValueOnce({ data, error })
  mocks.from.mockReturnValue(q)
  return q
}
beforeEach(() => vi.resetAllMocks())
test('AC-041.1.5: reads only open flags for the selected event and preserves arrangement identity and reasons', async () => {
  const flag = { id: eventId, venue_booking_id: eventId, equipment_booking_id: null,
    detail: 'Capacity exceeded', created_at: '2026-10-13T01:00:00Z', venue_booking: { venue: { name: 'Hall' } } }
  const q = query([flag])
  expect(await listArrangementReviews(eventId)).toEqual({ ok: true, value: [flag] })
  expect(mocks.from).toHaveBeenCalledWith('arrangement_review_flags')
  expect(q.eq.mock.calls).toEqual([['event_id', eventId], ['status', 'open']])
  expect(q.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: true }]])
  query([])
  expect(await listArrangementReviews(eventId)).toEqual({ ok: true, value: [] })
})
test('AC-041.1.6: invalid IDs, database errors, malformed responses and lost connections do not look like an empty review list', async () => {
  const failed = { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
  expect(await listArrangementReviews('invalid')).toEqual(failed)
  expect(mocks.from).not.toHaveBeenCalled()
  query(null, { message: 'Private database error' })
  expect(await listArrangementReviews(eventId)).toEqual(failed)
  query([{ detail: 'Incomplete record' }])
  expect(await listArrangementReviews(eventId)).toEqual(failed)
  mocks.from.mockImplementation(() => { throw new Error('Offline') })
  expect(await listArrangementReviews(eventId)).toEqual(failed)
})

test('AC-041.1.11: list counts distinct arrangements per event and returns errors rather than false zero counts', async () => {
  const rows = [
    { event_id: 'event1', venue_booking_id: 'booking1', equipment_booking_id: null },
    { event_id: 'event1', venue_booking_id: 'booking1', equipment_booking_id: null },
    { event_id: 'event1', venue_booking_id: null, equipment_booking_id: 'booking2' },
    { event_id: 'event2', venue_booking_id: 'booking3', equipment_booking_id: null },
  ]
  const eq = vi.fn().mockResolvedValue({ data: rows, error: null })
  mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) })
  expect(await listArrangementReviewCounts()).toEqual({ ok: true, value: { event1: 2, event2: 1 } })
  expect(mocks.from).toHaveBeenCalledTimes(1)
  expect(eq).toHaveBeenCalledWith('status', 'open')
  eq.mockResolvedValue({ data: null, error: { message: 'Offline' } })
  expect(await listArrangementReviewCounts()).toEqual({ ok: false, reason: ARRANGEMENT_REVIEW_ERROR })
})
