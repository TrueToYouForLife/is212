import { beforeEach, expect, test, vi } from 'vitest'
import { ARRANGEMENT_REVIEW_ERROR, listArrangementReviews, listArrangementReviewCounts, resolveArrangementReview, ARRANGEMENT_RESOLUTION_MESSAGES } from '../arrangementReviewService'
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
const eventId = '41100000-0000-0000-0000-000000000001'
function query(data: unknown, error: unknown = null) {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn() }
  q.order.mockReturnValueOnce(q).mockResolvedValueOnce({ data, error })
  mocks.from.mockReturnValue(q)
  return q
}
beforeEach(() => vi.resetAllMocks())
test('AC-041.1.5: reads open and resolved flags for the selected event and preserves arrangement identity and reasons', async () => {
  const flag = { id: eventId, venue_booking_id: eventId, equipment_booking_id: null,
    detail: 'Capacity exceeded', created_at: '2026-10-13T01:00:00Z', status: 'open', resolution: null, resolution_method: null, resolved_at: null, resolved_by: null, resolver: null, venue_booking: { venue: { name: 'Hall' } } }
  const history = { ...flag, status: 'resolved', resolution: 'Checked with venue staff', resolution_method: 'confirmed_valid',
    resolved_at: '2026-10-13T02:00:00Z', resolved_by: eventId, resolver: { full_name: 'Jaydon' } }
  const q = query([flag, history])
  expect(await listArrangementReviews(eventId)).toEqual({ ok: true, value: [flag, history] })
  expect(q.select.mock.calls[0][0]).toContain('resolved_by')
  expect(q.select.mock.calls[0][0]).toContain('resolver:profiles!arrangement_review_flags_resolved_by_fkey(full_name)')
  expect(mocks.from).toHaveBeenCalledWith('arrangement_review_flags')
  expect(q.eq.mock.calls).toEqual([['event_id', eventId]])
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

test('AC-041.6.2: resolution validates input, calls the protected RPC and handles refused, stale or uncertain writes', async () => {
  const invalid = { ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.invalid }
  for (const [id, method, note] of [[eventId, '', 'Reason'], [eventId, 'corrected', '  '], ['bad-id', 'confirmed_valid', 'Reason']]) {
    expect(await resolveArrangementReview(id, method, note)).toEqual(invalid)
  }
  expect(mocks.rpc).not.toHaveBeenCalled()
  for (const method of ['corrected', 'confirmed_valid']) {
    mocks.rpc.mockResolvedValue({ data: eventId, error: null })
    expect(await resolveArrangementReview(eventId, method, '  Verified arrangement  ')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenLastCalledWith('resolve_arrangement_review', { p_flag: eventId, p_method: method, p_note: 'Verified arrangement' })
  }
  for (const [code, reason] of [['42501', ARRANGEMENT_RESOLUTION_MESSAGES.forbidden], ['40001', ARRANGEMENT_RESOLUTION_MESSAGES.stale], ['22023', ARRANGEMENT_RESOLUTION_MESSAGES.invalid], ['unknown', ARRANGEMENT_RESOLUTION_MESSAGES.failed]]) {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } })
    expect(await resolveArrangementReview(eventId, 'corrected', 'Reason')).toEqual({ ok: false, reason })
  }
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await resolveArrangementReview(eventId, 'corrected', 'Reason')).toEqual({ ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.failed })
  mocks.rpc.mockRejectedValue(new Error('Offline'))
  expect(await resolveArrangementReview(eventId, 'corrected', 'Reason')).toEqual({ ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.failed })
})
