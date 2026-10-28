import { z } from 'zod'
import { supabase } from '../../lib/supabase'

/** US43 AC-043.4: one venue an event has booked, as the Safety Officer needs to see it. */
export interface QueueVenue {
  venue: string
  location: string | null
  layout: string | null
  attendance: number | null
  capacity: number | null
  accessibility: string[]
  restrictions: string[]
}

/** One equipment request, with how many items are actually reserved for it. */
export interface QueueEquipment {
  item: string
  quantity: number
  essential: boolean
  status: string
  reserved: number
}

export interface QueueEvent {
  eventId: string
  reference: string | null
  name: string
  sentAt: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  accessibility: string[]
  venues: QueueVenue[]
  equipment: QueueEquipment[]
}

export const SAFETY_QUEUE_MESSAGES = {
  notSafetyOfficer: 'Only a Safety Officer can see the events awaiting safety review.',
  failed: 'The safety review queue could not be loaded. Please try again.',
} as const

export type SafetyQueueResult = { ok: true; events: QueueEvent[] } | { ok: false; reason: string }

const venueSchema = z.object({
  venue: z.string(),
  location: z.string().nullable(),
  layout: z.string().nullable(),
  attendance: z.number().nullable(),
  capacity: z.number().nullable(),
  accessibility: z.array(z.string()),
  restrictions: z.array(z.string()),
})
const equipmentSchema = z.object({
  item: z.string(),
  quantity: z.number(),
  essential: z.boolean(),
  status: z.string(),
  reserved: z.number(),
})
const rowSchema = z.object({
  event_id: z.string(),
  reference: z.string().nullable(),
  name: z.string(),
  sent_at: z.string().nullable(),
  proposed_start: z.string().nullable(),
  proposed_end: z.string().nullable(),
  expected_attendance: z.number().nullable(),
  accessibility: z.array(z.string()),
  venues: z.array(venueSchema),
  equipment: z.array(equipmentSchema),
})

/** The events awaiting safety review, oldest first, with what the check needs (0109). */
export async function getSafetyReviewQueue(): Promise<SafetyQueueResult> {
  const { data, error } = await supabase.rpc('get_safety_review_queue')
  if (error) {
    if (error.code === '42501') return { ok: false, reason: SAFETY_QUEUE_MESSAGES.notSafetyOfficer }
    console.error('[safety] getSafetyReviewQueue', error)
    return { ok: false, reason: SAFETY_QUEUE_MESSAGES.failed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[safety] unexpected queue shape', parsed.error)
    return { ok: false, reason: SAFETY_QUEUE_MESSAGES.failed }
  }
  return {
    ok: true,
    events: parsed.data.map((row) => ({
      eventId: row.event_id,
      reference: row.reference,
      name: row.name,
      sentAt: row.sent_at,
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      expectedAttendance: row.expected_attendance,
      accessibility: row.accessibility,
      venues: row.venues,
      equipment: row.equipment,
    })),
  }
}
