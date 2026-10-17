import { supabase } from '../../lib/supabase'

/**
 * The assigned Coordinator's name for each event in a list. The database (0061) decides who may
 * see a name: staff for any event, an Organiser for their own, nobody else. A missing entry is
 * normal (unassigned, or not allowed), so callers fall back rather than fail.
 */
export const COORDINATOR_NAME_MESSAGES = {
  loadFailed: 'Coordinator names could not be loaded.',
} as const

type Result = { ok: true; value: Record<string, string> } | { ok: false; reason: string }

interface NameRow { event_id: string; coordinator_name: string }

export async function loadCoordinatorNames(eventIds: readonly string[]): Promise<Result> {
  // Nothing to ask for. The database refuses lists of more than 500 ids, so ask in chunks.
  if (eventIds.length === 0) return { ok: true, value: {} }

  const names: Record<string, string> = {}
  for (let start = 0; start < eventIds.length; start += 500) {
    const { data, error } = await supabase.rpc('event_coordinator_names', {
      p_event_ids: eventIds.slice(start, start + 500),
    })
    if (error) return { ok: false, reason: COORDINATOR_NAME_MESSAGES.loadFailed }
    for (const row of (data ?? []) as NameRow[]) names[row.event_id] = row.coordinator_name
  }
  return { ok: true, value: names }
}
