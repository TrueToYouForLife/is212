import { beforeEach, describe, expect, test, vi } from 'vitest'
import { notificationTarget } from '../notificationFormat'
import { getMyNotifications, markNotificationRead } from '../notificationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const NOTICE = {
  source: 'notice', id: 'n-1', event_id: 'e-1', event_name: 'Gala', event_reference: 'EVT-1',
  title: 'You are registered for Gala', detail: 'See you there.', created_at: '2039-01-01T01:00:00Z', item_id: null, read_at: null,
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AC-033.4 — a notice sent through the helper reaches the app like any other', () => {
  test('AC-033.4.10: an in-app copy is listed with its event, and is marked read by its source and id', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [NOTICE], error: null })
    const result = await getMyNotifications()
    expect(result).toMatchObject({ ok: true, notifications: [{ source: 'notice', id: 'n-1', eventName: 'Gala', title: 'You are registered for Gala' }] })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await markNotificationRead({ source: 'notice', id: 'n-1' })).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenLastCalledWith('mark_notification_read', { p_source: 'notice', p_id: 'n-1' })
  })

  test('AC-033.4.11: opening one goes where that role\'s other notices go', () => {
    expect(notificationTarget({ source: 'notice', eventId: 'e-1', itemId: null }, 'attendee')).toBe('/registrations')
    expect(notificationTarget({ source: 'notice', eventId: 'e-1', itemId: null }, 'organiser')).toBe('/requests/e-1')
  })
})
