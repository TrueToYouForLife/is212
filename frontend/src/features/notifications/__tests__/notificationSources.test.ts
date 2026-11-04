import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getMyNotifications } from '../notificationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const row = (source: string, id: string) => ({
  source, id, event_id: 'e-1', event_name: 'Gala', event_reference: 'EVT-1', title: `A ${source} notice`,
  detail: null, created_at: '2026-11-04T13:00:00+00:00', item_id: null, read_at: null,
})

// Every arm of get_my_notifications (latest: 0097). One unknown source rejects the whole feed,
// so a source added to the database must be added to the app in the same change.
const DATABASE_SOURCES = [
  'arrangement_review', 'change_request', 'coordinator_assignment', 'clarification_response',
  'equipment', 'venue_decision', 'venue_request', 'notice', 'email',
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-032.1 — the feed accepts every kind of notice the database sends', () => {
  test('AC-032.1.19: a coordinator with a clarification reply among their notices still sees their feed', async () => {
    mocks.rpc.mockResolvedValue({ data: [row('venue_decision', 'n-1'), row('clarification_response', 'n-2')], error: null })
    const result = await getMyNotifications()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.notifications.map((notice) => notice.source)).toEqual(['venue_decision', 'clarification_response'])
  })

  test('AC-032.1.20: one notice of every source the database can return loads together', async () => {
    mocks.rpc.mockResolvedValue({ data: DATABASE_SOURCES.map((source, index) => row(source, `n-${index}`)), error: null })
    const result = await getMyNotifications()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.notifications).toHaveLength(DATABASE_SOURCES.length)
  })
})
