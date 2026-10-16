import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { toEventChangeRequest } from './eventChangeRequestService'
import type { EventChangeRequestRow } from './eventChangeRequestService'
import type { ChangeRequestReviewContext, EventStatus } from './types'

export const CHANGE_REVIEW_LOAD_MESSAGES = {
  unavailable: 'This review is unavailable. Only the event’s assigned coordinator can review its change requests.',
  failed: 'The change-request review could not be loaded. Please try again.',
} as const

export type ChangeRequestReviewContextResult =
  | { ok: true; context: ChangeRequestReviewContext }
  | { ok: false; reason: string }

/** Embedded requests and event values share a database snapshot; two separate reads
 * could otherwise pair a new version with old displayed details. RLS still applies
 * to the embedded requests. Assignment is filtered again for a clear UI boundary. */
export async function getChangeRequestReviewContext(eventId: string): Promise<ChangeRequestReviewContextResult> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: CHANGE_REVIEW_LOAD_MESSAGES.unavailable }
  }
  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    if (authError || !session?.user) return { ok: false, reason: CHANGE_REVIEW_LOAD_MESSAGES.unavailable }
    const { data, error } = await supabase.from('events')
      .select('id, coordinator_id, status, updated_at, name, purpose, event_type, description, proposed_start, proposed_end, expected_attendance, programme, layout_preference, accessibility_requirements, equipment_requirements, registration_required, special_arrangements, event_change_requests(id, event_id, proposed_changes, reason, status, submitted_at, reviewed_at, review_note, field_decisions, review_version, reply_history, event_change_review_history(id, request_version, outcome, proposed_changes, field_decisions, review_note, reviewer_name, reviewed_at))')
      .eq('id', eventId)
      .eq('coordinator_id', session.user.id)
      .maybeSingle()
    if (error) return { ok: false, reason: CHANGE_REVIEW_LOAD_MESSAGES.failed }
    if (!data || data.id !== eventId || data.coordinator_id !== session.user.id) {
      return { ok: false, reason: CHANGE_REVIEW_LOAD_MESSAGES.unavailable }
    }
    const rows: EventChangeRequestRow[] = data.event_change_requests ?? []
    return { ok: true, context: {
      eventId: data.id, eventStatus: data.status as EventStatus, eventUpdatedAt: data.updated_at,
      currentValues: {
        name: data.name ?? '', purpose: data.purpose ?? '', eventType: data.event_type ?? '',
        description: data.description ?? '', proposedStart: data.proposed_start ?? '',
        proposedEnd: data.proposed_end ?? '', expectedAttendance: data.expected_attendance ?? '',
        programme: data.programme ?? '', layoutPreference: data.layout_preference ?? '',
        accessibilityRequirements: data.accessibility_requirements ?? '',
        equipmentRequirements: data.equipment_requirements ?? '',
        registrationRequired: data.registration_required ?? false,
        specialArrangements: data.special_arrangements ?? '',
      },
      requests: rows.map(toEventChangeRequest)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    } }
  } catch {
    return { ok: false, reason: CHANGE_REVIEW_LOAD_MESSAGES.failed }
  }
}
