import { supabase } from '../../lib/supabase'
import { validateEventDraft } from './draftValidation'
import type { EventRequestInput, SaveableEventDraft, SaveEventDraftResult } from './types'

export const DRAFT_MESSAGES = {
  notSignedIn: 'Sign in before saving an event draft.',
  notPermitted: 'You are not permitted to save this draft.',
  unknownOrganiser: 'Your organiser profile could not be found. Contact a coordinator.',
  invalidDetails: 'Some draft details are invalid. Check your entries and try again.',
  unavailable: 'This draft is unavailable or is no longer a draft. Refresh before continuing.',
  saveFailed: 'The draft save could not be confirmed. Check your requests before trying again.',
} as const

function toDraftFields(draft: SaveableEventDraft) {
  return {
    name: draft.name,
    purpose: draft.purpose,
    event_type: draft.eventType,
    description: draft.description,
    proposed_start: draft.proposedStart?.toISOString() ?? null,
    proposed_end: draft.proposedEnd?.toISOString() ?? null,
    expected_attendance: draft.expectedAttendance,
    programme: draft.programme,
    layout_preference: draft.layoutPreference,
    accessibility_requirements: draft.accessibilityRequirements,
    equipment_requirements: draft.equipmentRequirements,
    registration_required: draft.registrationRequired,
    special_arrangements: draft.specialArrangements,
  }
}

function describeError(code?: string): string {
  switch (code) {
    case '42501': return DRAFT_MESSAGES.notPermitted
    case '23503': return DRAFT_MESSAGES.unknownOrganiser
    case '23514': return DRAFT_MESSAGES.invalidDetails
    default: return DRAFT_MESSAGES.saveFailed
  }
}

/**
 * Save a complete snapshot of the form, not a partial patch. Pass the returned ID on
 * subsequent saves so editing updates the existing draft instead of inserting a copy.
 * RLS remains the authority for access; these filters also guard against stale forms.
 */
export async function saveEventDraft(
  input: EventRequestInput,
  draftId?: string,
): Promise<SaveEventDraftResult> {
  const validation = validateEventDraft(input)
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.issues.map((issue) => issue.message).join(' '),
      issues: validation.issues,
    }
  }
  if (draftId !== undefined && !draftId.trim()) {
    return { ok: false, reason: DRAFT_MESSAGES.unavailable, issues: [] }
  }

  try {
    const { data: session, error: authError } = await supabase.auth.getUser()
    const organiserId = session?.user?.id
    if (authError || !organiserId) {
      return { ok: false, reason: DRAFT_MESSAGES.notSignedIn, issues: [] }
    }

    const fields = toDraftFields(validation.value)
    const query = draftId === undefined
      ? supabase.from('events').insert({ ...fields, organiser_id: organiserId, status: 'draft' })
      : supabase.from('events').update(fields)
        .eq('id', draftId)
        .eq('organiser_id', organiserId)
        // Never revert a submitted request to draft or edit it through this path.
        .eq('status', 'draft')

    const { data, error } = await query.select('id, status, updated_at').maybeSingle()
    if (error) return { ok: false, reason: describeError(error.code), issues: [] }
    if (!data) {
      return {
        ok: false,
        reason: draftId === undefined ? DRAFT_MESSAGES.saveFailed : DRAFT_MESSAGES.unavailable,
        issues: [],
      }
    }
    if (!data.id || data.status !== 'draft' || !data.updated_at) {
      return { ok: false, reason: DRAFT_MESSAGES.saveFailed, issues: [] }
    }
    return {
      ok: true,
      draft: { id: data.id, status: 'draft', updatedAt: data.updated_at },
    }
  } catch {
    // A lost response does not prove that a write failed; avoid promising a safe retry.
    return { ok: false, reason: DRAFT_MESSAGES.saveFailed, issues: [] }
  }
}
