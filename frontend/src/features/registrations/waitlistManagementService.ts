import { supabase } from '../../lib/supabase'
import type { LoadResult, ManagedWaitlistEntry, ManagedWaitlistStatus, WaitlistMove } from './types'

/**
 * US16 SCRUM-154: the only module the Coordinator's waiting-list screen talks to Supabase through.
 * The Coordinator is always the signed-in user; the database checks that they are assigned to the
 * event, so naming another event's entry gets the same refusal as an unknown one.
 */

export const WAITLIST_MANAGEMENT_MESSAGES = {
  notAssigned: 'Only the coordinator assigned to this event can manage its waiting list.',
  notConfirmed: 'The waiting list can only be reordered while the event is Confirmed.',
  notWaiting: 'That person is no longer waiting, so they cannot be moved. The list has been reloaded.',
  moveFailed: 'The waiting list could not be reordered. Please try again.',
  loadFailed: 'The waiting list could not be loaded. Please try again.',
} as const

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: string; stale: boolean }

interface ManagedWaitlistRow {
  entry_id: string
  attendee_name: string
  status: ManagedWaitlistStatus
  queue_position: number | null
  joined_at: string
  offer_expires_at: string | null
}

export async function loadEventWaitlist(eventId: string): Promise<LoadResult<ManagedWaitlistEntry[]>> {
  const { data, error } = await supabase.rpc('list_event_waitlist', { p_event_id: eventId })
  if (error) {
    return { ok: false, reason: error.code === '42501'
      ? WAITLIST_MANAGEMENT_MESSAGES.notAssigned : WAITLIST_MANAGEMENT_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    value: ((data ?? []) as ManagedWaitlistRow[]).map((row) => ({
      entryId: row.entry_id,
      attendeeName: row.attendee_name,
      status: row.status,
      position: row.queue_position,
      joinedAt: row.joined_at,
      offerExpiresAt: row.offer_expires_at,
    })),
  }
}

export async function moveWaitlistEntry(entryId: string, move: WaitlistMove): Promise<MoveResult> {
  const { error } = await supabase.rpc('move_waitlist_entry', { p_entry_id: entryId, p_move: move })
  if (!error) return { ok: true }

  // 55000 and 22000 mean the screen was out of date, so it reloads instead of offering a retry.
  if (error.code === '55000') return { ok: false, stale: true, reason: WAITLIST_MANAGEMENT_MESSAGES.notWaiting }
  if (error.code === '22000') return { ok: false, stale: true, reason: WAITLIST_MANAGEMENT_MESSAGES.notConfirmed }
  if (error.code === '42501') return { ok: false, stale: false, reason: WAITLIST_MANAGEMENT_MESSAGES.notAssigned }
  return { ok: false, stale: false, reason: WAITLIST_MANAGEMENT_MESSAGES.moveFailed }
}
