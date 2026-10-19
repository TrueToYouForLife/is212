import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { organiserStatusLabel } from './status/organiserStatusLabel'
import type { EventStatus } from './types'

/**
 * US31 slice 2: the only module that talks to Supabase about an Organiser's client
 * organisation. Colleagues cannot read the events table for an event they do not own, so
 * everything here goes through the read-only projections in 0078, which return the agreed
 * public fields and nothing else.
 *
 * There is no write path in this file, and there should not be one. AC-031.2 says a
 * colleague may look and no more; the owner's own actions keep their existing services
 * (eventService, eventChangeRequestService, eventReviewService), which are scoped to
 * organiser_id = auth.uid() in the database.
 *
 * The types live here rather than in the feature's shared types.ts purely to keep this
 * slice out of a file five other stories are editing at the same time. Move them if the
 * organisation view grows beyond one screen.
 */

export const ORGANISATION_EVENT_MESSAGES = {
  loadFailed: 'Your organisation’s events could not be loaded. Please try again.',
  notFound: 'That event could not be found, or it belongs to another organisation.',
} as const

export interface OrganisationEvent {
  id: string
  reference: string | null
  name: string | null
  status: EventStatus
  /** Pre-resolved so the list and the detail page cannot disagree about wording. */
  statusLabel: string
  proposedStart: string | null
  proposedEnd: string | null
  organiserName: string
  /** AC-031.1 vs AC-031.2: the caller may act on their own events and only view a colleague's. */
  isMine: boolean
}

export interface OrganisationEventDetail extends OrganisationEvent {
  purpose: string | null
  eventType: string | null
  expectedAttendance: number | null
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; reason: string }

interface OrganisationEventRow {
  id: string
  reference: string | null
  name: string | null
  status: string
  proposed_start: string | null
  proposed_end: string | null
  organiser_name: string
  is_mine: boolean
}

interface OrganisationEventDetailRow extends OrganisationEventRow {
  purpose: string | null
  event_type: string | null
  expected_attendance: number | null
}

/**
 * organiserStatusLabel is called with no review note, and that is not an oversight: 0078
 * deliberately withholds review_note from the projection, so a colleague sees "In review"
 * where the owner might see "Clarification required". What the coordinator asked the
 * organiser to clarify is between those two.
 */
function toOrganisationEvent(row: OrganisationEventRow): OrganisationEvent {
  const status = row.status as EventStatus
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    status,
    statusLabel: organiserStatusLabel(status),
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    organiserName: row.organiser_name,
    isMine: row.is_mine,
  }
}

/**
 * A read error and an empty organisation are different answers and must stay different.
 * Collapsing a failed read into an empty list would show "no events yet" to someone whose
 * colleagues have plenty — the same defect US42 hit (AC-042.1.4).
 */
export async function loadOrganisationEvents(): Promise<LoadResult<OrganisationEvent[]>> {
  const { data, error } = await supabase.rpc('list_organisation_events')
  if (error) {
    console.error('[events] loadOrganisationEvents', error)
    return { ok: false, reason: ORGANISATION_EVENT_MESSAGES.loadFailed }
  }
  return { ok: true, value: ((data ?? []) as OrganisationEventRow[]).map(toOrganisationEvent) }
}

export async function loadOrganisationEvent(
  eventId: string,
): Promise<LoadResult<OrganisationEventDetail>> {
  // An id that cannot be a uuid gets the same answer as one belonging to another
  // organisation, without a round trip. Any other response would tell a caller something
  // about ids they are not entitled to probe.
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: ORGANISATION_EVENT_MESSAGES.notFound }
  }

  const { data, error } = await supabase.rpc('get_organisation_event', { p_event_id: eventId })
  if (error) {
    console.error('[events] loadOrganisationEvent', error)
    return { ok: false, reason: ORGANISATION_EVENT_MESSAGES.loadFailed }
  }

  // No row means another organisation's event, a draft, or nothing at all — 0078 does not
  // say which, so neither does this. That is AC-031.3's "including through a direct link":
  // distinguishing the cases would confirm the event exists.
  const row = ((data ?? []) as OrganisationEventDetailRow[])[0]
  if (!row) return { ok: false, reason: ORGANISATION_EVENT_MESSAGES.notFound }

  return {
    ok: true,
    value: {
      ...toOrganisationEvent(row),
      purpose: row.purpose,
      eventType: row.event_type,
      expectedAttendance: row.expected_attendance,
    },
  }
}
