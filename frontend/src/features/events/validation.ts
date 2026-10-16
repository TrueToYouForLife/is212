import { z } from 'zod'
import type {
  EventRequestInput,
  SubmittableEventRequest,
  ValidationIssue,
  ValidationResult,
} from './types'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * Every AC-005.2 rule lives here, which is what lets the form, the service and the
 * unit tests all agree on one definition of "valid" instead of three. The database
 * repeats the core rules as CHECK constraints (see 0001_events.sql); that is
 * deliberate defence in depth — this layer exists for the error message, the
 * constraint exists for integrity when something bypasses this layer.
 */

export const VALIDATION_MESSAGES = {
  purposeRequired: 'Purpose is required.',
  startRequired: 'A preferred start date and time is required.',
  startInvalid: 'The preferred start date and time is not a valid date.',
  endRequired: 'A preferred end date and time is required.',
  endInvalid: 'The preferred end date and time is not a valid date.',
  endBeforeStart: 'The end date and time must be after the start date and time.',
  startInPast: 'The preferred start date and time must be in the future.',
  attendanceRequired: 'The expected number of attendees is required.',
  attendanceNumeric: 'The expected number of attendees must be a whole number.',
  attendancePositive: 'The expected number of attendees must be at least 1.',
} as const

/** Optional free-text collapses to null, so "" and "   " never reach the database. */
const optionalText = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => {
    const trimmed = (value ?? '').trim()
    return trimmed.length > 0 ? trimmed : null
  })

const purposeSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => (value ?? '').trim())
  .refine((value) => value.length > 0, VALIDATION_MESSAGES.purposeRequired)

const dateTimeSchema = (missing: string, invalid: string) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => (value ?? '').trim())
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: missing })
      } else if (Number.isNaN(new Date(value).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: invalid })
      }
    })
    .transform((value) => new Date(value))

// HTML number inputs hand back strings, and an empty one is "" rather than undefined.
// Normalising here keeps the numeric rules expressed as numeric rules.
const attendanceSchema = z.preprocess(
  (value) => {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (trimmed.length === 0) return undefined
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? trimmed : parsed
  },
  z
    .number({
      required_error: VALIDATION_MESSAGES.attendanceRequired,
      invalid_type_error: VALIDATION_MESSAGES.attendanceNumeric,
    })
    .int(VALIDATION_MESSAGES.attendanceNumeric)
    .positive(VALIDATION_MESSAGES.attendancePositive),
)

/**
 * Built per call rather than as a module constant so "in the past" is measured against
 * an injected clock. A schema that closed over `new Date()` at import time would make
 * the past-date test depend on when the suite happens to run.
 */
export const createEventRequestSchema = (now: Date) =>
  z
    .object({
      name: optionalText,
      purpose: purposeSchema,
      eventType: optionalText,
      description: optionalText,
      proposedStart: dateTimeSchema(
        VALIDATION_MESSAGES.startRequired,
        VALIDATION_MESSAGES.startInvalid,
      ),
      proposedEnd: dateTimeSchema(
        VALIDATION_MESSAGES.endRequired,
        VALIDATION_MESSAGES.endInvalid,
      ),
      expectedAttendance: attendanceSchema,
      programme: optionalText,
      layoutPreference: optionalText,
      accessibilityRequirements: optionalText,
      equipmentRequirements: optionalText,
      registrationRequired: z.boolean().optional().default(false),
      specialArrangements: optionalText,
    })
    .superRefine((value, ctx) => {
      // Half-open interval [start, end): an event ending exactly when it starts has no
      // duration, so equality fails too. Mirrors events_interval_ordered in SQL.
      if (value.proposedEnd <= value.proposedStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposedEnd'],
          message: VALIDATION_MESSAGES.endBeforeStart,
        })
      }

      if (value.proposedStart.getTime() <= now.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposedStart'],
          message: VALIDATION_MESSAGES.startInPast,
        })
      }
    })

/**
 * AC-005.2. Returns every offending field at once so the form can mark all of them,
 * rather than making the organiser resubmit to discover the next problem.
 */
export function validateEventRequest(
  input: EventRequestInput,
  options: { now?: Date } = {},
): ValidationResult {
  const now = options.now ?? new Date()
  const result = createEventRequestSchema(now).safeParse(input)

  if (result.success) {
    // Deliberately assigned, not cast: if the schema and SubmittableEventRequest ever
    // drift apart, this line is the compile error that tells us.
    const value: SubmittableEventRequest = result.data
    return { ok: true, value }
  }

  const issues: ValidationIssue[] = []
  const seen = new Set<string>()

  for (const issue of result.error.issues) {
    // One message per field: a blank date trips both "missing" and "not a date", and
    // showing both under the same input reads as a bug.
    const field = (issue.path[0] as ValidationIssue['field']) ?? 'form'
    if (seen.has(field)) continue
    seen.add(field)
    issues.push({ field, message: issue.message })
  }

  return { ok: false, issues }
}
