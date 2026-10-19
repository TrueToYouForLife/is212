import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import type { AppNotification } from './types'

export const NOTIFICATION_MESSAGES = {
  notSignedIn: 'Sign in to see your notifications.',
  loadFailed: 'Your notifications could not be loaded. Please try again.',
  markFailed: 'That notification could not be marked as read. Please try again.',
  markAllFailed: 'Your notifications could not be marked as read. Please try again.',
} as const

/** Fired after notifications are marked read, so the unread count in the nav refreshes. */
export const NOTIFICATIONS_CHANGED = 'connectsphere:notifications-changed'

function announceChange() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
}

export type NotificationListResult =
  | { ok: true; notifications: AppNotification[] }
  | { ok: false; reason: string }

const rowSchema = z.object({
  source: z.enum(['arrangement_review', 'change_request', 'coordinator_assignment', 'equipment', 'venue_decision', 'venue_request', 'email', 'notice']),
  id: z.string(),
  event_id: z.string().nullable(),
  event_name: z.string().nullable(),
  event_reference: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  created_at: z.string(),
  item_id: z.string().nullable(),
  read_at: z.string().nullable(),
})

/**
 * AC-032.1, AC-032.5: the signed-in user's notifications from every source, newest first.
 * The database decides what is theirs (0072); nothing is filtered here.
 */
export async function getMyNotifications(limit = 100): Promise<NotificationListResult> {
  const { data, error } = await supabase.rpc('get_my_notifications', { p_limit: limit })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: NOTIFICATION_MESSAGES.notSignedIn }
    console.error('[notifications] getMyNotifications', error)
    return { ok: false, reason: NOTIFICATION_MESSAGES.loadFailed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[notifications] getMyNotifications: unexpected shape', parsed.error)
    return { ok: false, reason: NOTIFICATION_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    notifications: parsed.data.map((row) => ({
      source: row.source,
      id: row.id,
      eventId: row.event_id,
      eventName: row.event_name,
      eventReference: row.event_reference,
      title: row.title,
      detail: row.detail,
      createdAt: row.created_at,
      itemId: row.item_id,
      readAt: row.read_at,
    })),
  }
}

export type CountResult = { ok: true; count: number } | { ok: false; reason: string }

/** AC-032.2: how many of the user's notifications are unread. */
export async function getUnreadNotificationCount(): Promise<CountResult> {
  const { data, error } = await supabase.rpc('count_my_unread_notifications')
  if (error) {
    if (error.code === '42501') return { ok: false, reason: NOTIFICATION_MESSAGES.notSignedIn }
    console.error('[notifications] getUnreadNotificationCount', error)
    return { ok: false, reason: NOTIFICATION_MESSAGES.loadFailed }
  }
  return { ok: true, count: typeof data === 'number' ? data : 0 }
}

/** AC-032.3: marks one notification read. Only one in the user's own feed can be (0073). */
export async function markNotificationRead(notification: Pick<AppNotification, 'source' | 'id'>): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { error } = await supabase.rpc('mark_notification_read', { p_source: notification.source, p_id: notification.id })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: NOTIFICATION_MESSAGES.notSignedIn }
    console.error('[notifications] markNotificationRead', error)
    return { ok: false, reason: NOTIFICATION_MESSAGES.markFailed }
  }
  announceChange()
  return { ok: true }
}

/** AC-032.4: marks every one of the user's notifications read; returns how many were unread. */
export async function markAllNotificationsRead(): Promise<CountResult> {
  const { data, error } = await supabase.rpc('mark_all_notifications_read')
  if (error) {
    if (error.code === '42501') return { ok: false, reason: NOTIFICATION_MESSAGES.notSignedIn }
    console.error('[notifications] markAllNotificationsRead', error)
    return { ok: false, reason: NOTIFICATION_MESSAGES.markAllFailed }
  }
  announceChange()
  return { ok: true, count: typeof data === 'number' ? data : 0 }
}
