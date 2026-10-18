import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  NOTIFICATIONS_CHANGED, NOTIFICATION_MESSAGES as messages, getMyNotifications, getUnreadNotificationCount,
  markAllNotificationsRead, markNotificationRead,
} from '../notificationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const ROW = {
  source: 'venue_decision', id: 'n-1', event_id: 'e-1', event_name: 'Gala', event_reference: 'EVT-1',
  title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', created_at: '2026-10-10T07:04:00+00:00',
  item_id: 'b-1', read_at: null,
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
        title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', createdAt: '2026-10-10T07:04:00+00:00',
        itemId: 'b-1', readAt: null },
      { source: 'email', id: 'n-2', eventId: 'e-1', eventName: null, eventReference: null,
        title: 'Venue booking rejected', detail: null, createdAt: '2026-10-10T07:04:00+00:00',
        itemId: 'b-1', readAt: null },
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

describe('AC-032.2 — unread notifications stand out, with an unread count', () => {
  test('AC-032.2.3: the unread count is read in one call; an answer without a number counts as none', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 4, error: null })
    expect(await getUnreadNotificationCount()).toEqual({ ok: true, count: 4 })
    expect(mocks.rpc).toHaveBeenCalledWith('count_my_unread_notifications')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getUnreadNotificationCount()).toEqual({ ok: true, count: 0 })
  })

  test('AC-032.2.4: a count that cannot be read is reported and logged; signed out asks to sign in', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await getUnreadNotificationCount()).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalled()
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sign in' } })
    expect(await getUnreadNotificationCount()).toEqual({ ok: false, reason: messages.notSignedIn })
  })
})

describe('AC-032.3 — opening a notification marks it read', () => {
  test('AC-032.3.5: marking one read names it by source and id, and tells the nav to refresh its count', async () => {
    const changed = vi.fn()
    window.addEventListener(NOTIFICATIONS_CHANGED, changed)
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await markNotificationRead({ source: 'email', id: 'n-1' })).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('mark_notification_read', { p_source: 'email', p_id: 'n-1' })
    expect(changed).toHaveBeenCalledTimes(1)
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed)
  })

  test('AC-032.3.6: a notification that cannot be marked is reported and logged, and the count is not refreshed', async () => {
    const changed = vi.fn()
    window.addEventListener(NOTIFICATIONS_CHANGED, changed)
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'Notification not found' } })
    expect(await markNotificationRead({ source: 'email', id: 'n-1' })).toEqual({ ok: false, reason: messages.markFailed })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sign in' } })
    expect(await markNotificationRead({ source: 'email', id: 'n-1' })).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(changed).not.toHaveBeenCalled()
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed)
  })
})

describe('AC-032.4 — a user can mark all notifications as read', () => {
  test('AC-032.4.2: marking all read reports how many there were and refreshes the count', async () => {
    const changed = vi.fn()
    window.addEventListener(NOTIFICATIONS_CHANGED, changed)
    mocks.rpc.mockResolvedValueOnce({ data: 3, error: null })
    expect(await markAllNotificationsRead()).toEqual({ ok: true, count: 3 })
    expect(mocks.rpc).toHaveBeenCalledWith('mark_all_notifications_read')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await markAllNotificationsRead()).toEqual({ ok: true, count: 0 })
    expect(changed).toHaveBeenCalledTimes(2)
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed)
  })

  test('AC-032.4.3: a failed mark-all is reported and logged; signed out asks to sign in', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await markAllNotificationsRead()).toEqual({ ok: false, reason: messages.markAllFailed })
    expect(console.error).toHaveBeenCalled()
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sign in' } })
    expect(await markAllNotificationsRead()).toEqual({ ok: false, reason: messages.notSignedIn })
  })
})
