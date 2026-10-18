import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NOTIFICATION_MESSAGES as messages, getMyNotifications } from '../notificationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const ROW = {
  source: 'venue_decision', id: 'n-1', event_id: 'e-1', event_name: 'Gala', event_reference: 'EVT-1',
  title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', created_at: '2026-10-10T07:04:00+00:00',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-032.1 — a user sees their notifications, newest first', () => {
  test('AC-032.1.11: the feed is read in one call and each row becomes a notification, in the order given', async () => {
    mocks.rpc.mockResolvedValue({ data: [ROW, { ...ROW, id: 'n-2', source: 'email', event_name: null, event_reference: null, detail: null }], error: null })
    expect(await getMyNotifications(50)).toEqual({ ok: true, notifications: [
      { source: 'venue_decision', id: 'n-1', eventId: 'e-1', eventName: 'Gala', eventReference: 'EVT-1',
        title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', createdAt: '2026-10-10T07:04:00+00:00' },
      { source: 'email', id: 'n-2', eventId: 'e-1', eventName: null, eventReference: null,
        title: 'Venue booking rejected', detail: null, createdAt: '2026-10-10T07:04:00+00:00' },
    ] })
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_notifications', { p_limit: 50 })
  })

  test('AC-032.1.12: with nothing sent yet the list is empty, and up to 100 are asked for by default', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await getMyNotifications()).toEqual({ ok: true, notifications: [] })
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_notifications', { p_limit: 100 })
  })

  test('AC-032.1.13: a failed or unexpected answer is reported and logged, never shown as an empty list', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await getMyNotifications()).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ ...ROW, source: 'telepathy' }], error: null })
    expect(await getMyNotifications()).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe('AC-032.5 — a user only ever sees their own notifications', () => {
  test('AC-032.5.6: a signed-out request is refused by the database and the user is asked to sign in', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Sign in to see your notifications' } })
    expect(await getMyNotifications()).toEqual({ ok: false, reason: messages.notSignedIn })
  })
})
