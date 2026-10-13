import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const flagSchema = z.object({
  id: z.string().uuid(),
  venue_booking_id: z.string().uuid().nullable(),
  equipment_booking_id: z.string().uuid().nullable(),
  detail: z.string(),
  created_at: z.string(),
  venue_booking: z.object({ venue: z.object({ name: z.string() }).nullable() }).nullable(),
})
export type ArrangementReviewFlag = z.infer<typeof flagSchema>
export const ARRANGEMENT_REVIEW_ERROR = 'Arrangement reviews could not be loaded. Please try again.'

/** RLS restricts these records to the event's current assigned coordinator. */
export async function listArrangementReviews(eventId: string): Promise<
  { ok: true; value: ArrangementReviewFlag[] } | { ok: false; reason: string }
> {
  if (!z.string().uuid().safeParse(eventId).success) return { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
  try {
    const { data, error } = await supabase.from('arrangement_review_flags')
      .select('id, venue_booking_id, equipment_booking_id, detail, created_at, venue_booking:venue_bookings(venue:venues(name))')
      .eq('event_id', eventId).eq('status', 'open')
      .order('created_at', { ascending: false }).order('id', { ascending: true })
    if (error) return { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
    const parsed = z.array(flagSchema).safeParse(data)
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
  } catch {
    return { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
  }
}

/** Count arrangements, not reasons. One query serves the whole coordinator list. */
export async function listArrangementReviewCounts(): Promise<
  { ok: true; value: Record<string, number> } | { ok: false; reason: string }
> {
  try {
    const { data, error } = await supabase.from('arrangement_review_flags')
      .select('event_id, venue_booking_id, equipment_booking_id').eq('status', 'open')
    if (error || !data) return { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
    const groups = new Map<string, Set<string>>()
    for (const row of data) {
      const key = row.venue_booking_id ? `venue:${row.venue_booking_id}` : `equipment:${row.equipment_booking_id}`
      const arrangements = groups.get(row.event_id) ?? new Set<string>()
      arrangements.add(key)
      groups.set(row.event_id, arrangements)
    }
    return { ok: true, value: Object.fromEntries(Array.from(groups, ([id, arrangements]) => [id, arrangements.size])) }
  } catch {
    return { ok: false, reason: ARRANGEMENT_REVIEW_ERROR }
  }
}
