import { z } from 'zod'
import { arrangementResolutionSchema } from './arrangementReviewValidation'
import { supabase } from '../../lib/supabase'

const flagSchema = z.object({
  id: z.string().uuid(),
  venue_booking_id: z.string().uuid().nullable(),
  equipment_booking_id: z.string().uuid().nullable(),
  detail: z.string(),
  created_at: z.string(),
  status: z.enum(['open', 'resolved']),
  resolution: z.string().nullable(),
  resolution_method: z.enum(['corrected', 'confirmed_valid']).nullable(),
  resolved_at: z.string().nullable(),
  resolved_by: z.string().uuid().nullable(),
  resolver: z.object({ full_name: z.string().nullable() }).nullable(),
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
      .select('id, venue_booking_id, equipment_booking_id, detail, created_at, status, resolution, resolution_method, resolved_at, resolved_by, resolver:profiles!arrangement_review_flags_resolved_by_fkey(full_name), venue_booking:venue_bookings(venue:venues(name))')
      .eq('event_id', eventId)
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

export const ARRANGEMENT_RESOLUTION_MESSAGES = {
  invalid: 'Choose how this reason was resolved and provide an explanation.',
  forbidden: 'Only the currently assigned coordinator can resolve this review. Refresh to check your access.',
  stale: 'This reason has already been resolved. Refresh arrangement reviews to see the latest history.',
  failed: 'The resolution could not be confirmed. Your explanation is kept; refresh arrangement reviews before retrying.',
} as const

export async function resolveArrangementReview(flagId: string, method: string, note: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const input = arrangementResolutionSchema.safeParse({ flagId, method, note })
  if (!input.success) return { ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.invalid }
  try {
    const { data, error } = await supabase.rpc('resolve_arrangement_review', {
      p_flag: input.data.flagId, p_method: input.data.method, p_note: input.data.note,
    })
    if (error) {
      const reason = error.code === '42501' ? ARRANGEMENT_RESOLUTION_MESSAGES.forbidden
        : error.code === '40001' ? ARRANGEMENT_RESOLUTION_MESSAGES.stale
        : error.code === '22023' ? ARRANGEMENT_RESOLUTION_MESSAGES.invalid : ARRANGEMENT_RESOLUTION_MESSAGES.failed
      return { ok: false, reason }
    }
    return data === flagId ? { ok: true } : { ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.failed }
  } catch {
    return { ok: false, reason: ARRANGEMENT_RESOLUTION_MESSAGES.failed }
  }
}
