import { z } from 'zod'
import { supabase } from '../../../lib/supabase'
import type { AuditEntry } from './types'

export const AUDIT_MESSAGES = {
  notAllowed: "Only the event's assigned Coordinator and the Coordinator Lead can see its audit trail.",
  loadFailed: 'The audit trail could not be loaded. Please try again.',
} as const

export type AuditResult = { ok: true; entries: AuditEntry[] } | { ok: false; reason: string }

const values = z.record(z.string(), z.unknown()).nullable()
const rowSchema = z.object({
  id: z.string(),
  action: z.string(),
  item_type: z.string(),
  item_id: z.string(),
  old_values: values,
  new_values: values,
  occurred_at: z.string(),
  actor_id: z.string().nullable(),
  actor_name: z.string().nullable(),
})

/**
 * AC-034.3, AC-034.4: the event's audit records in time order. The database decides who may
 * read them and refuses everyone else, so a refusal is reported rather than shown as an empty
 * trail. Order is the database's; nothing here re-sorts or filters.
 */
export async function getEventAuditTrail(eventId: string): Promise<AuditResult> {
  const { data, error } = await supabase.rpc('get_event_audit_log', { p_event_id: eventId })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: AUDIT_MESSAGES.notAllowed }
    console.error('[audit] getEventAuditTrail', error)
    return { ok: false, reason: AUDIT_MESSAGES.loadFailed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[audit] getEventAuditTrail: unexpected shape', parsed.error)
    return { ok: false, reason: AUDIT_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    entries: parsed.data.map((row) => ({
      id: row.id, action: row.action, itemType: row.item_type, itemId: row.item_id,
      oldValues: row.old_values, newValues: row.new_values, occurredAt: row.occurred_at,
      actorId: row.actor_id, actorName: row.actor_name,
    })),
  }
}
