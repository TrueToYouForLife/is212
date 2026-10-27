import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SAFETY_QUEUE_MESSAGES as messages, getSafetyReviewQueue } from '../safetyReviewQueueService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const ROW = {
  event_id: 'e-1', reference: 'EVT-1', name: 'Conference', sent_at: '2042-03-08T01:00:00Z',
  proposed_start: '2042-03-10T01:00:00Z', proposed_end: '2042-03-10T03:00:00Z', expected_attendance: 100,
  accessibility: ['Wheelchair access'],
  venues: [{ venue: 'Hall', location: 'Level 1', layout: 'Theatre', attendance: 100, capacity: 150, accessibility: [], restrictions: ['Under maintenance'] }],
  equipment: [{ item: 'Projector', quantity: 2, essential: true, status: 'reserved', reserved: 2 }],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-043.4 — a Safety Officer sees the events awaiting review', () => {
  test('AC-043.4.8: the queue is read once, kept in the order the database gives, and named for the app', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [ROW, { ...ROW, event_id: 'e-2', reference: null }], error: null })
    const result = await getSafetyReviewQueue()
    expect(mocks.rpc).toHaveBeenCalledWith('get_safety_review_queue')
    expect(result).toEqual({ ok: true, events: [
      expect.objectContaining({ eventId: 'e-1', reference: 'EVT-1', sentAt: '2042-03-08T01:00:00Z', expectedAttendance: 100,
        accessibility: ['Wheelchair access'], venues: ROW.venues, equipment: ROW.equipment }),
      expect.objectContaining({ eventId: 'e-2', reference: null }),
    ] })
  })

  test('AC-043.4.9: a non-Safety Officer is told it is not theirs; any other failure or unexpected answer says to try again', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'x' } })
    expect(await getSafetyReviewQueue()).toEqual({ ok: false, reason: messages.notSafetyOfficer })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'x' } })
    expect(await getSafetyReviewQueue()).toEqual({ ok: false, reason: messages.failed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ event_id: 'e-1' }], error: null })
    expect(await getSafetyReviewQueue()).toEqual({ ok: false, reason: messages.failed })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getSafetyReviewQueue()).toEqual({ ok: true, events: [] })
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
