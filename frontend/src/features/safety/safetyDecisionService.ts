import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { SAFETY_FACTORS } from './safetyDecision'
import type { SafetyDecisionForm, SafetyDecisionKind } from './safetyDecision'

export const SAFETY_DECISION_MESSAGES = {
  notSafetyOfficer: 'Only a Safety Officer can decide a safety review.',
  notAwaiting: 'This event is no longer awaiting safety review.',
  notSwitchedOn: 'The safety review is not switched on yet.',
  notAllowed: 'Only the event\'s assigned Coordinator or a Safety Officer can see its safety review decisions.',
  failed: 'The safety review decision could not be saved. Please try again.',
  loadFailed: 'The safety review decisions could not be loaded. Please try again.',
} as const

export type RecordDecisionResult = { ok: true; status: string } | { ok: false; reason: string }

/** US44 AC-044.1 to AC-044.6: records the Safety Officer's decision (0111). */
export async function recordSafetyReviewDecision(eventId: string, form: SafetyDecisionForm): Promise<RecordDecisionResult> {
  const approve = form.decision === 'approve'
  const { data, error } = await supabase.rpc('record_safety_review_decision', {
    p_event_id: eventId,
    p_decision: form.decision,
    p_comment: form.comment.trim() || null,
    p_revisit: approve ? [] : form.revisit,
    p_assessments: SAFETY_FACTORS.map((factor) => {
      const answer = form.assessments[factor.code]
      return { factor: factor.code, concern: answer.concern === true, note: answer.note.trim() || null }
    }),
  })
  if (!error) return { ok: true, status: String(data) }
  if (error.code === '42501') return { ok: false, reason: SAFETY_DECISION_MESSAGES.notSafetyOfficer }
  if (error.code === '22000') return { ok: false, reason: SAFETY_DECISION_MESSAGES.notAwaiting }
  if (error.code === '0A000') return { ok: false, reason: SAFETY_DECISION_MESSAGES.notSwitchedOn }
  if (error.code === '22023') return { ok: false, reason: error.message }
  console.error('[safety] recordSafetyReviewDecision', error)
  return { ok: false, reason: SAFETY_DECISION_MESSAGES.failed }
}

export interface DecisionAssessment {
  factor: string
  concern: boolean
  note: string | null
}

export interface SafetyReviewDecision {
  decisionId: string
  decision: SafetyDecisionKind
  comment: string | null
  revisit: string[]
  decidedAt: string
  decidedByName: string | null
  assessments: DecisionAssessment[]
}

export type DecisionsResult = { ok: true; decisions: SafetyReviewDecision[] } | { ok: false; reason: string }

const rowSchema = z.object({
  decision_id: z.string(),
  decision: z.enum(['approve', 'request_changes', 'reject']),
  comment: z.string().nullable(),
  revisit: z.array(z.string()),
  decided_at: z.string(),
  decided_by_name: z.string().nullable(),
  assessments: z.array(z.object({ factor: z.string(), concern: z.boolean(), note: z.string().nullable() })),
})

/** AC-044.5 / AC-044.6: an event's decisions, newest first (assigned Coordinator or Safety Officer). */
export async function getSafetyReviewDecisions(eventId: string): Promise<DecisionsResult> {
  const { data, error } = await supabase.rpc('get_safety_review_decisions', { p_event_id: eventId })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: SAFETY_DECISION_MESSAGES.notAllowed }
    console.error('[safety] getSafetyReviewDecisions', error)
    return { ok: false, reason: SAFETY_DECISION_MESSAGES.loadFailed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[safety] unexpected decisions shape', parsed.error)
    return { ok: false, reason: SAFETY_DECISION_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    decisions: parsed.data.map((row) => ({
      decisionId: row.decision_id,
      decision: row.decision,
      comment: row.comment,
      revisit: row.revisit,
      decidedAt: row.decided_at,
      decidedByName: row.decided_by_name,
      assessments: row.assessments,
    })),
  }
}
