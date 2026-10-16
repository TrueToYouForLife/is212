import { supabase } from '../../lib/supabase'
import type { ListEventDraftsResult, LoadEventDraftResult } from './types'

export const DRAFT_LOAD_MESSAGES = {
  notSignedIn: 'Sign in before opening an event draft.',
  unavailable: 'This draft is unavailable or is no longer a draft.',
  loadFailed: 'The draft could not be loaded. Please try again.',
  listFailed: 'Your drafts could not be loaded. Please try again.',
} as const

// Explicit columns avoid requesting review-only data when reopening an organiser's draft.
const DRAFT_COLUMNS =
  'id, organiser_id, status, updated_at, name, purpose, event_type, description, proposed_start, proposed_end, expected_attendance, programme, layout_preference, accessibility_requirements, equipment_requirements, registration_required, special_arrangements'

/** Read only: opening a draft must not save it or trigger submission. */
export async function getEventDraft(id: string): Promise<LoadEventDraftResult> {
  if (!id.trim()) return { ok: false, reason: DRAFT_LOAD_MESSAGES.unavailable }

  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    const organiserId = session?.user?.id
    if (authError || !organiserId) {
      return { ok: false, reason: DRAFT_LOAD_MESSAGES.notSignedIn }
    }

    const { data, error } = await supabase.from('events')
      .select(DRAFT_COLUMNS)
      .eq('id', id)
      .eq('organiser_id', organiserId)
      .eq('status', 'draft')
      .maybeSingle()

    if (error) return { ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed }
    // Keep missing, inaccessible and submitted requests indistinguishable.
    // These client checks supplement RLS; they do not replace database permissions.
    if (!data || data.id !== id || data.organiser_id !== organiserId || data.status !== 'draft') {
      return { ok: false, reason: DRAFT_LOAD_MESSAGES.unavailable }
    }

    return {
      ok: true,
      draft: {
        id: data.id,
        status: 'draft',
        updatedAt: data.updated_at,
        values: {
          name: data.name ?? '',
          purpose: data.purpose ?? '',
          eventType: data.event_type ?? '',
          description: data.description ?? '',
          proposedStart: data.proposed_start ?? '',
          proposedEnd: data.proposed_end ?? '',
          expectedAttendance: data.expected_attendance ?? '',
          programme: data.programme ?? '',
          layoutPreference: data.layout_preference ?? '',
          accessibilityRequirements: data.accessibility_requirements ?? '',
          equipmentRequirements: data.equipment_requirements ?? '',
          registrationRequired: data.registration_required ?? false,
          specialArrangements: data.special_arrangements ?? '',
        },
      },
    }
  } catch {
    return { ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed }
  }
}

/** Listing drafts never includes submitted requests or another organiser's drafts. */
export async function listEventDrafts(): Promise<ListEventDraftsResult> {
  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    const organiserId = session?.user?.id
    if (authError || !organiserId) {
      return { ok: false, reason: DRAFT_LOAD_MESSAGES.notSignedIn }
    }
    const { data, error } = await supabase.from('events')
      .select('id, organiser_id, status, updated_at, name, purpose')
      .eq('organiser_id', organiserId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
    if (error) return { ok: false, reason: DRAFT_LOAD_MESSAGES.listFailed }
    return {
      ok: true,
      drafts: (data ?? [])
        .filter((row) => row.organiser_id === organiserId && row.status === 'draft')
        .map((row) => ({
          id: row.id, status: 'draft', updatedAt: row.updated_at,
          name: row.name, purpose: row.purpose,
        })),
    }
  } catch {
    return { ok: false, reason: DRAFT_LOAD_MESSAGES.listFailed }
  }
}
