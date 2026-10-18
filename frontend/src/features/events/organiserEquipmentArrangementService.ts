import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const arrangementSchema = z.object({
  requirement_id: z.string().uuid(),
  equipment_name: z.string().trim().min(1),
  quantity_requested: z.number().int().positive(),
  quantity_reserved: z.number().int().nonnegative(),
  status: z.enum(['pending_review', 'reserved', 'partially_reserved', 'unavailable']),
}).strict().refine((row) => row.quantity_reserved <= row.quantity_requested)

export type OrganiserEquipmentArrangement = z.infer<typeof arrangementSchema>
export const EQUIPMENT_ARRANGEMENTS_ERROR = 'Equipment arrangements could not be loaded. Please try again.'

/** Ownership is enforced by the RPC; only the organiser-safe response is accepted here. */
export async function loadOrganiserEquipmentArrangements(eventId: string): Promise<
  { ok: true; value: OrganiserEquipmentArrangement[] } | { ok: false; reason: string }
> {
  const failure = { ok: false as const, reason: EQUIPMENT_ARRANGEMENTS_ERROR }
  if (!z.string().uuid().safeParse(eventId).success) return failure
  try {
    const { data, error } = await supabase.rpc('get_organiser_equipment_arrangements', {
      p_event_id: eventId,
    })
    if (error) return failure
    const parsed = z.array(arrangementSchema).safeParse(data)
    return parsed.success ? { ok: true, value: parsed.data } : failure
  } catch {
    return failure
  }
}
