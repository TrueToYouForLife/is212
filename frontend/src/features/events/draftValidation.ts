import { z } from 'zod'
import type { DraftValidationResult, EventRequestInput, SaveableEventDraft, ValidationIssue } from './types'
import { VALIDATION_MESSAGES } from './validation'

const optionalText = z.string().nullish().transform((value) => value?.trim() || null)

const optionalDate = (message: string) => optionalText
  .refine((value) => value === null || !Number.isNaN(new Date(value).getTime()), message)
  .transform((value) => value === null ? null : new Date(value))

const optionalAttendance = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value ?? null
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? trimmed : parsed
  },
  z.number({ invalid_type_error: VALIDATION_MESSAGES.attendanceNumeric })
    .int(VALIDATION_MESSAGES.attendanceNumeric)
    .positive(VALIDATION_MESSAGES.attendancePositive)
    // PostgreSQL's integer column cannot store values above this limit.
    .max(2147483647, 'The expected number of attendees must not exceed 2147483647.')
    .nullable(),
)

const draftSchema = z.object({
  name: optionalText,
  purpose: optionalText,
  eventType: optionalText,
  description: optionalText,
  proposedStart: optionalDate(VALIDATION_MESSAGES.startInvalid),
  proposedEnd: optionalDate(VALIDATION_MESSAGES.endInvalid),
  expectedAttendance: optionalAttendance,
  programme: optionalText,
  layoutPreference: optionalText,
  accessibilityRequirements: optionalText,
  equipmentRequirements: optionalText,
  registrationRequired: z.boolean().optional().default(false),
  specialArrangements: optionalText,
}).superRefine((value, ctx) => {
  // Incomplete dates are allowed, but supplied dates must satisfy the DB constraint.
  if (value.proposedStart && value.proposedEnd && value.proposedEnd <= value.proposedStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proposedEnd'],
      message: VALIDATION_MESSAGES.endBeforeStart,
    })
  }
  // Old drafts can still be saved. Submission validation checks for future dates.
})

/** Save Draft Event Request: validate unfinished form data without submitting or contacting Supabase. */
export function validateEventDraft(input: EventRequestInput): DraftValidationResult {
  const result = draftSchema.safeParse(input)
  if (result.success) {
    const value: SaveableEventDraft = result.data
    return { ok: true, value }
  }

  const issues: ValidationIssue[] = []
  const seen = new Set<string>()
  for (const issue of result.error.issues) {
    const field = (issue.path[0] as ValidationIssue['field']) ?? 'form'
    if (seen.has(field)) continue
    seen.add(field)
    issues.push({ field, message: issue.message })
  }
  return { ok: false, issues }
}
