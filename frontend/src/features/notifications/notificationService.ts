import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import type { AppNotification } from './types'

export const NOTIFICATION_MESSAGES = {
  notSignedIn: 'Sign in to see your notifications.',
  loadFailed: 'Your notifications could not be loaded. Please try again.',
} as const

export type NotificationListResult =
  | { ok: true; notifications: AppNotification[] }
  | { ok: false; reason: string }

const rowSchema = z.object({
  source: z.enum(['arrangement_review', 'change_request', 'coordinator_assignment', 'equipment', 'venue_decision', 'venue_request', 'email']),
  id: z.string(),
  event_id: z.string().nullable(),
  event_name: z.string().nullable(),
  event_reference: z.string().nullable(),
  title: z.string(),
  detail: z.string().nullable(),
  created_at: z.string(),
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
    })),
  }
}
