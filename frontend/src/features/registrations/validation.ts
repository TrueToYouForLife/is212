import { z } from 'zod'
import type {
  ManagedWaitlistEntry, MyRegistration, RegistrationAnswers, WaitlistMove, WaitlistState,
  WithdrawableRegistration,
} from './types'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * The same rules are enforced again by register_for_event (0043). These exist to give a
 * specific message before a round trip, not to secure anything.
 */

export const REGISTRATION_MESSAGES = {
  phoneRequired: 'Enter a phone number.',
  phoneInvalid: 'Enter a phone number of 8 to 15 digits.',
  prerequisitesRequired: 'Confirm that you meet the prerequisites.',
} as const

// US15 A1, matching the database: 8 to 15 digits once spaces and hyphens are removed, with an
// optional leading +. No country-specific rule, because Attendees are not only Singaporean.
const PHONE_DIGITS = /^\+?\d{8,15}$/
const isPhoneNumber = (value: string) => PHONE_DIGITS.test(value.replace(/[\s-]/g, ''))

// Optional free text: trimmed, and a blank answer is stored as null rather than ''.
const optionalText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = (value ?? '').trim()
    return trimmed === '' ? null : trimmed
  })

/** The answers schema for one event; the confirmation is only required when it has prerequisites. */
export function registrationSchema(hasPrerequisites: boolean) {
  return z.object({
    phone: z
      .string()
      .trim()
      .min(1, REGISTRATION_MESSAGES.phoneRequired)
      .refine(isPhoneNumber, REGISTRATION_MESSAGES.phoneInvalid),
    dietaryRequirements: optionalText,
    accessibilityNeeds: optionalText,
    prerequisitesConfirmed: z
      .boolean()
      .optional()
      .transform((value) => value ?? false)
      .refine((confirmed) => !hasPrerequisites || confirmed, REGISTRATION_MESSAGES.prerequisitesRequired),
  })
}

/** What the form holds before cleaning: blanks are '' and nothing is required yet. */
export interface RegistrationInput {
  phone?: string
  dietaryRequirements?: string | null
  accessibilityNeeds?: string | null
  prerequisitesConfirmed?: boolean
}

export interface RegistrationIssue {
  field: keyof RegistrationAnswers
  message: string
}

export type RegistrationValidation =
  | { ok: true; answers: RegistrationAnswers }
  | { ok: false; issues: RegistrationIssue[] }

export function validateRegistration(
  input: RegistrationInput,
  options: { hasPrerequisites: boolean },
): RegistrationValidation {
  const result = registrationSchema(options.hasPrerequisites).safeParse({
    ...input,
    phone: input.phone ?? '',
  })
  if (result.success) return { ok: true, answers: result.data }

  // One message per field: an empty phone trips both "required" and "8 to 15 digits".
  const issues: RegistrationIssue[] = []
  for (const issue of result.error.issues) {
    const field = issue.path[0] as RegistrationIssue['field']
    if (!issues.some((existing) => existing.field === field)) {
      issues.push({ field, message: issue.message })
    }
  }
  return { ok: false, issues }
}

/**
 * US23 AC-023.1: whether to offer "Withdraw". The same rule as withdraw_registration (0050): an
 * active registration, a Confirmed event, and a start still in the future. Half-open, so an event
 * starting exactly now has started. This only decides what to show; the database decides.
 */
export function canWithdraw(registration: WithdrawableRegistration, now: Date): boolean {
  return (
    registration.registrationStatus === 'registered' &&
    registration.eventStatus === 'confirmed' &&
    new Date(registration.start).getTime() > now.getTime()
  )
}

/**
 * US15 AC-015.7: whether a registration's event name can link to its details page. That page
 * (get_open_event) only answers for an event that is Confirmed and has not started, so linking
 * any other event would lead to "This event is not open for registration". Registration being
 * switched off later (US52) can still make a link a dead end; the page then says so.
 */
export function hasEventDetailsPage(registration: Pick<MyRegistration, 'eventStatus' | 'start'>, now: Date): boolean {
  return registration.eventStatus === 'confirmed' && new Date(registration.start).getTime() > now.getTime()
}

/**
 * US16 AC-016.3: whether an offer can still be accepted. Mirrors accept_waitlist_offer (0058),
 * which expires an overdue offer itself; this only stops the form being shown for one that has
 * lapsed while the page stayed open. Half-open: an offer expiring exactly now has lapsed.
 */
export function canAcceptOffer(waitlist: Pick<WaitlistState, 'status' | 'offerExpiresAt'>, now: Date): boolean {
  return (
    waitlist.status === 'offered' &&
    waitlist.offerExpiresAt !== null &&
    new Date(waitlist.offerExpiresAt).getTime() > now.getTime()
  )
}

/**
 * US16 SCRUM-154: which moves the Coordinator can make for one entry. Mirrors move_waitlist_entry
 * (0060): only someone still waiting moves, never past either end of the queue. The list is read in
 * queue order. This only decides which buttons to enable; the database decides.
 */
export function availableMoves(
  entries: readonly Pick<ManagedWaitlistEntry, 'entryId' | 'status'>[],
  entryId: string,
): Record<WaitlistMove, boolean> {
  const waiting = entries.filter((entry) => entry.status === 'waiting')
  const index = waiting.findIndex((entry) => entry.entryId === entryId)
  if (index === -1) return { front: false, up: false, down: false }
  return { front: index > 0, up: index > 0, down: index < waiting.length - 1 }
}
