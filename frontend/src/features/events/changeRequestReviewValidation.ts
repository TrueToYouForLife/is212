import { z } from 'zod'
import type { ChangeRequestReviewValidationResult, ProposedEventChanges } from './types'

// Match US6's field names. Reject unexpected keys rather than allowing workflow
// fields such as status or organiserId to become part of an approved event update.
const changeFieldsSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  eventType: z.string(),
  description: z.string(),
  proposedStart: z.string(),
  proposedEnd: z.string(),
  expectedAttendance: z.string(),
  programme: z.string(),
  layoutPreference: z.string(),
  accessibilityRequirements: z.string(),
  equipmentRequirements: z.string(),
  registrationRequired: z.boolean(),
  specialArrangements: z.string(),
}).partial().strict()

const proposedChangesSchema = changeFieldsSchema.refine(
  (changes) => Object.keys(changes).length > 0
    && Object.values(changes).every((value) => value !== undefined),
)

const decisionSchema = z.object({
  field: changeFieldsSchema.keyof(),
  decision: z.enum(['approved', 'rejected', 'clarification_requested']),
  note: z.string().trim().default(''),
}).strict()

const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('decide'), decisions: z.array(decisionSchema) }).strict(),
  z.object({ action: z.literal('clarify'), note: z.string().trim() }).strict(),
])

export const CHANGE_REVIEW_MESSAGES = {
  invalidChanges: 'The proposed changes could not be read. Reload the request before reviewing it.',
  invalidReview: 'Choose a valid review action and decisions.',
  incompleteDecisions: 'Choose one decision for every proposed change, without duplicates or extra fields.',
  rejectionNoteRequired: 'Give a reason or follow-up for each rejected change.',
  clarificationRequired: 'Explain what the organiser needs to clarify.',
} as const

/**
 * Pure review rules: no writes, role checks or notifications. A later database
 * operation must recheck permissions/current state and validate the resulting event
 * (e.g. accepting just one date must not create an invalid date range).
 * Clarification leaves the whole request unresolved; it applies no proposed values.
 */
export function validateChangeRequestReview(
  proposedChanges: unknown,
  input: unknown,
): ChangeRequestReviewValidationResult {
  const changes = proposedChangesSchema.safeParse(proposedChanges)
  if (!changes.success) return { ok: false, reason: CHANGE_REVIEW_MESSAGES.invalidChanges }
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: CHANGE_REVIEW_MESSAGES.invalidReview }

  if (parsed.data.action === 'clarify') {
    if (!parsed.data.note) return { ok: false, reason: CHANGE_REVIEW_MESSAGES.clarificationRequired }
    return { ok: true, review: {
      status: 'clarification_requested', note: parsed.data.note, approvedChanges: {},
    } }
  }

  const { decisions } = parsed.data
  const fields = Object.keys(changes.data)
  if (decisions.length !== fields.length
    || new Set(decisions.map(({ field }) => field)).size !== fields.length
    || decisions.some(({ field }) => !Object.hasOwn(changes.data, field))) {
    return { ok: false, reason: CHANGE_REVIEW_MESSAGES.incompleteDecisions }
  }
  if (decisions.some(({ decision, note }) => decision === 'rejected' && !note)) {
    return { ok: false, reason: CHANGE_REVIEW_MESSAGES.rejectionNoteRequired }
  }
  if (decisions.some(({ decision, note }) => decision === 'clarification_requested' && !note)) {
    return { ok: false, reason: CHANGE_REVIEW_MESSAGES.clarificationRequired }
  }
  // Approval is provisional until every field is resolved. Keep all decisions for
  // the next review round, but expose no values that could be applied prematurely.
  if (decisions.some(({ decision }) => decision === 'clarification_requested')) {
    return { ok: true, review: {
      status: 'clarification_requested', decisions, approvedChanges: {},
    } }
  }

  const accepted = decisions.filter(({ decision }) => decision === 'approved')
  const approvedChanges = Object.fromEntries(
    accepted.map(({ field }) => [field, changes.data[field]]),
  ) as ProposedEventChanges
  return { ok: true, review: {
    status: accepted.length === 0 ? 'rejected'
      : accepted.length === fields.length ? 'approved' : 'partially_approved',
    decisions,
    approvedChanges,
  } }
}
