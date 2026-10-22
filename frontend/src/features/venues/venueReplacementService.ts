import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const details = z.object({ purpose: z.string().nullable(), proposedStart: z.string().nullable(), proposedEnd: z.string().nullable(),
  expectedAttendance: z.number().nullable(), layoutPreference: z.string().nullable(),
  accessibilityRequirements: z.array(z.string()), facilityRequirements: z.array(z.string()), specialArrangements: z.string().nullable() })
const request = z.object({ id: z.string().uuid(), originalBookingId: z.string().uuid(), eventName: z.string(),
  originalVenue: z.string(), targetVenue: z.string(), targetVenueId: z.string().uuid(), reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']), proposedBy: z.string(), proposedAt: z.string(),
  decidedBy: z.string().nullable(), decidedAt: z.string().nullable(), decisionNote: z.string().nullable(),
  replacementBookingId: z.string().uuid().nullable(), version: z.string(), sourceChanged: z.boolean(), details,
  targetCapacity: z.number(), targetLayout: z.string(), targetAccessibility: z.array(z.string()).nullable(), targetFacilities: z.record(z.unknown()).nullable() })
const affectedBooking = z.object({
  id: z.string().uuid(), eventId: z.string().uuid(), eventName: z.string(), venueName: z.string(),
  version: z.string().min(1), details, needsReplacement: z.literal(true),
  reasons: z.array(z.object({ id: z.string().uuid(), store: z.enum(['booking', 'arrangement', 'venue']),
    code: z.enum(['venue_blocked', 'venue_retired']), detail: z.string().min(1) })).min(1),
})
export type AffectedVenueBooking = z.infer<typeof affectedBooking>
const context = z.object({
  sources: z.array(affectedBooking),
  affectedBookings: z.array(affectedBooking),
  venues: z.array(z.object({ id: z.string().uuid(), name: z.string(), capacity: z.number(), location: z.string() })),
  requests: z.array(request),
})
export type VenueReplacementContext = z.infer<typeof context>
export type VenueReplacementRequest = z.infer<typeof request>
export type ReplacementDecision = 'approved' | 'rejected' | 'withdrawn'
export const REPLACEMENT_MESSAGES = {
  load: 'Venue replacements could not be loaded. Please reload.',
  invalid: 'Choose a booking and replacement venue, and provide a note.',
  forbidden: 'Your role or event assignment does not permit this action.',
  stale: 'The booking, event or proposal changed. Reload; withdraw or reject an outdated proposal before submitting another.',
  conflict: 'The replacement conflicts with a reservation, block or another pending request. The original booking is unchanged.',
  ineligible: 'The event or venue is no longer eligible for replacement. Reload and check the details.',
  failed: 'The result could not be confirmed. Reload before trying again.',
} as const
export async function getVenueReplacements(): Promise<{ ok: true; value: VenueReplacementContext } | { ok: false; reason: string }> {
  try {
    const { data, error } = await supabase.rpc('get_venue_replacements')
    const parsed = context.safeParse(data)
    return !error && parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: REPLACEMENT_MESSAGES.load }
  } catch { return { ok: false, reason: REPLACEMENT_MESSAGES.load } }
}
async function mutate(name: string, args: Record<string, string>): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { data, error } = await supabase.rpc(name, args)
    if (error) return { ok: false, reason: error.code === '42501' ? REPLACEMENT_MESSAGES.forbidden
      : error.code === '40001' ? REPLACEMENT_MESSAGES.stale
        : ['23505', '23514'].includes(error.code) ? REPLACEMENT_MESSAGES.conflict
          : error.code === '22023' ? REPLACEMENT_MESSAGES.ineligible : REPLACEMENT_MESSAGES.failed }
    return z.string().uuid().safeParse(data).success ? { ok: true } : { ok: false, reason: REPLACEMENT_MESSAGES.failed }
  } catch { return { ok: false, reason: REPLACEMENT_MESSAGES.failed } }
}
export async function proposeVenueReplacement(booking: string, target: string, version: string, reason: string) {
  if (!z.string().uuid().safeParse(booking).success || !z.string().uuid().safeParse(target).success || !version || !reason.trim())
    return { ok: false as const, reason: REPLACEMENT_MESSAGES.invalid }
  return mutate('propose_venue_replacement', { p_booking: booking, p_target: target, p_version: version, p_reason: reason.trim() })
}
export async function decideVenueReplacement(id: string, version: string, decision: ReplacementDecision, note: string) {
  if (!z.string().uuid().safeParse(id).success || !version || !note.trim() || !['approved', 'rejected', 'withdrawn'].includes(decision))
    return { ok: false as const, reason: REPLACEMENT_MESSAGES.invalid }
  return mutate('decide_venue_replacement', { p_request: id, p_version: version, p_decision: decision, p_note: note.trim() })
}
