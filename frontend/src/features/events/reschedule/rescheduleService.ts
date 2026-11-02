import { supabase } from '../../../lib/supabase'
import type { EventStatus } from '../types'

/** US21: the statuses an event can be rescheduled from (0122's reschedule_event()). */
export const RESCHEDULABLE_STATUSES: readonly EventStatus[] = [
  'approved', 'planning', 'awaiting_safety_review', 'safety_changes_requested', 'in_preparation', 'confirmed', 'postponed',
]

export function canReschedule(status: EventStatus): boolean {
  return RESCHEDULABLE_STATUSES.includes(status)
}

export const RESCHEDULE_MESSAGES = {
  notAllowed: 'Only the event\'s assigned Coordinator can reschedule it.',
  notReschedulable: 'This event can no longer be rescheduled.',
  failed: 'The event could not be rescheduled. Please try again.',
} as const

export type RescheduleResult = { ok: true; status: EventStatus } | { ok: false; reason: string }

/** AC-021.1, AC-021.2, AC-021.4: moves the event to its new date (0122). */
export async function rescheduleEvent(eventId: string, startsAt: string, endsAt: string, reason: string): Promise<RescheduleResult> {
  const { data, error } = await supabase.rpc('reschedule_event', {
    p_event_id: eventId,
    p_start: startsAt,
    p_end: endsAt,
    p_reason: reason.trim() || null,
  })
  if (!error) return { ok: true, status: data as EventStatus }
  if (error.code === '42501') return { ok: false, reason: RESCHEDULE_MESSAGES.notAllowed }
  if (error.code === '22000') return { ok: false, reason: RESCHEDULE_MESSAGES.notReschedulable }
  // The database explains what is wrong with the new date (end before start, in the past, unchanged).
  if (error.code === '22023') return { ok: false, reason: error.message }
  console.error('[reschedule] rescheduleEvent', error)
  return { ok: false, reason: RESCHEDULE_MESSAGES.failed }
}
