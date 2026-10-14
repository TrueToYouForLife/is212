import { z } from 'zod'
import type { DraftValidationResult, EventRequestInput, SaveableEventDraft, ValidationIssue } from './types'
import { VALIDATION_MESSAGES, codeListSchema, layoutCodeSchema } from './validation'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from './requirementCatalogue'
import type { RequirementCodeOptions } from './validation'

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

const ACCESSIBILITY_CODES = ACCESSIBILITY_OPTIONS.map((option) => option.code)
const FACILITY_CODES = FACILITY_OPTIONS.map((option) => option.code)

/**
 * A draft may be missing anything, but a requirement it does hold must still be a real
 * code: the column constraints from 0052 apply to a draft row exactly as they do to a
 * submitted one, so accepting an unknown code here would only move the failure to the
 * save. Unticked groups are empty lists, which is always valid.
 */
const createDraftSchema = (codes: RequirementCodeOptions) => z.object({
  name: optionalText,
  purpose: optionalText,
  eventType: optionalText,
  description: optionalText,
  proposedStart: optionalDate(VALIDATION_MESSAGES.startInvalid),
  proposedEnd: optionalDate(VALIDATION_MESSAGES.endInvalid),
  expectedAttendance: optionalAttendance,
  programme: optionalText,
  layoutPreference: layoutCodeSchema(codes.layouts),
  accessibilityRequirements: codeListSchema(
    ACCESSIBILITY_CODES, VALIDATION_MESSAGES.accessibilityUnknown),
  facilityRequirements: codeListSchema(
    FACILITY_CODES, VALIDATION_MESSAGES.facilityUnknown),
  equipmentRequirements: codeListSchema(
    codes.equipment, VALIDATION_MESSAGES.equipmentUnknown),
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
export function validateEventDraft(
  input: EventRequestInput,
  options: { codes?: RequirementCodeOptions } = {},
): DraftValidationResult {
  const result = createDraftSchema(options.codes ?? {}).safeParse(input)
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
