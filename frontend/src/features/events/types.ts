import type { ChangeRequestReplyRound } from './changeRequestReplyTypes'
export const EVENT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'planning',
  'awaiting_safety_review',
  'safety_changes_requested',
  'in_preparation',
  'confirmed',
  // US38 (0119): a planned event the Coordinator has paused.
  'postponed',
  'completed',
  'cancelled',
  'rejected',
  // US22 (0066). Lost from this list when the safety stages were added, which left
  // statusRules, StatusBadge and RequestStatusPanel referring to a status the union no
  // longer had. The database CHECK in 0108 has always included it.
  'withdrawn',
] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]

// Stored lowercase so the value matches the database CHECK constraint exactly; the
// human-facing wording AC-002.3/AC-002.5 asks for is a presentation concern.
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  planning: 'Planning',
  awaiting_safety_review: 'Awaiting safety review',
  safety_changes_requested: 'Safety changes requested',
  in_preparation: 'In preparation',
  confirmed: 'Confirmed',
  postponed: 'Postponed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

/**
 * The four requirement fields are catalogue codes, not free text (0054):
 *
 *   layoutPreference           one layout_types code, or null for "no preference"
 *   accessibilityRequirements  accessibility_types codes
 *   facilityRequirements       facility_types codes — what the room must already have
 *   equipmentRequirements      equipment_types codes — portable kit, brought in
 *
 * facility and equipment are separate on purpose. A projector fixed in the ceiling is a
 * venue feature and filters venue search (venues.facility); a projector on a trolley is
 * equipment and is reserved through US13/US14. One combined list could not do both.
 */

/**
 * What a form (or a test) hands to validation: every field optional, because that is what
 * a partly filled form produces. Validation is what turns this into a
 * SubmittableEventRequest; nothing else in the app should assume these are present.
 */
export interface EventRequestInput {
  name?: string
  purpose?: string
  eventType?: string
  description?: string
  proposedStart?: string
  proposedEnd?: string
  expectedAttendance?: string | number
  programme?: string
  layoutPreference?: string | null
  accessibilityRequirements?: readonly string[]
  facilityRequirements?: readonly string[]
  equipmentRequirements?: readonly string[]
  registrationRequired?: boolean
  specialArrangements?: string
}

/** Form state is always fully populated, unlike the partial input validation accepts.
 *  An unticked checkbox group is an empty array, and "no layout preference" is ''. */
export interface EventRequestFormValues {
  name: string
  purpose: string
  eventType: string
  description: string
  proposedStart: string
  proposedEnd: string
  expectedAttendance: string
  programme: string
  layoutPreference: string
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  equipmentRequirements: string[]
  registrationRequired: boolean
  specialArrangements: string
}

/** A request that has passed every AC-002.2 rule. Only validation.ts may produce one. */
export interface SubmittableEventRequest {
  name: string | null
  purpose: string
  eventType: string | null
  description: string | null
  proposedStart: Date
  proposedEnd: Date
  expectedAttendance: number
  programme: string | null
  layoutPreference: string | null
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  equipmentRequirements: string[]
  registrationRequired: boolean
  specialArrangements: string | null
}

/** A validated draft keeps submission-only required fields nullable. */
export type SaveableEventDraft = Omit<
  SubmittableEventRequest,
  'purpose' | 'proposedStart' | 'proposedEnd' | 'expectedAttendance'
> & {
  purpose: string | null
  proposedStart: Date | null
  proposedEnd: Date | null
  expectedAttendance: number | null
}

export type DraftValidationResult =
  | { ok: true; value: SaveableEventDraft }
  | { ok: false; issues: ValidationIssue[] }

export interface SavedEventDraft {
  id: string
  status: 'draft'
  updatedAt: string
}

/** Loaded dates remain ISO timestamps; the editor converts them for datetime inputs. */
export interface LoadedEventDraft extends SavedEventDraft {
  values: EventRequestInput
}

export type SaveEventDraftResult =
  | { ok: true; draft: SavedEventDraft }
  | { ok: false; reason: string; issues: ValidationIssue[] }

export type LoadEventDraftResult =
  | { ok: true; draft: LoadedEventDraft }
  | { ok: false; reason: string }

export interface EventDraftSummary extends SavedEventDraft {
  name: string | null
  purpose: string | null
}

export type ListEventDraftsResult =
  | { ok: true; drafts: EventDraftSummary[] }
  | { ok: false; reason: string }

/** What the caller of the service gets back on a successful submission. */
export interface SubmittedEvent {
  id: string
  reference: string
  status: EventStatus
  submittedAt: string | null
}

/** Enough of an event to list it. Dates stay as ISO strings until something renders them. */
export interface EventRequestSummary {
  /** Missing means not loaded; only explicit null means unassigned. */
  coordinatorId?: string | null
  reviewNote?: string | null
  id: string
  reference: string | null
  organiserId: string
  name: string | null
  purpose: string | null
  eventType: string | null
  proposedStart: string | null
  proposedEnd: string | null
  expectedAttendance: number | null
  status: EventStatus
  submittedAt: string | null
}

/** Everything AC-002.1 captured, for a coordinator deciding on it. */
export interface EventRequestDetail extends EventRequestSummary {
  description: string | null
  programme: string | null
  layoutPreference: string | null
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  equipmentRequirements: string[]
  registrationRequired: boolean
  specialArrangements: string | null
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string | null
  /**
   * US37: the version the reader was shown, passed back untouched when answering a
   * clarification request so 0096 can refuse an answer to a question that has since
   * changed. Optional because the summary read does not carry it and a fixture need not
   * supply one; clarificationResponseService treats its absence as a reason to reload
   * rather than sending an answer unversioned.
   */
  updatedAt?: string | null
}

export interface ValidationIssue {
  field: keyof EventRequestFormValues | 'form'
  message: string
}

export type ValidationResult =
  | { ok: true; value: SubmittableEventRequest }
  | { ok: false; issues: ValidationIssue[] }

export type SubmitEventRequestResult =
  | { ok: true; event: SubmittedEvent }
  | { ok: false; reason: string; issues: ValidationIssue[] }

// US4 - Review decision record (AC-004.5)

/** 'returned' is under_review -> submitted: the coordinator asking for more detail. */
export type ReviewDecisionOutcome = 'approved' | 'rejected' | 'returned'

/**
 * One retained review decision. Written only by the database trigger in
 * 0009_review_decisions.sql, so the browser can read this but never create or edit it.
 * decidedByName is a snapshot taken when the decision was made.
 */
export interface ReviewDecision {
  id: string
  fromStatus: EventStatus
  decision: ReviewDecisionOutcome
  reason: string | null
  decidedByName: string
  decidedAt: string
}

  // US6 - Request Change for Event

export type ChangeRequestStatus =
  | 'submitted' | 'approved' | 'partially_approved' | 'rejected'
  | 'clarification_requested' | 'withdrawn'

/**
 * A partial diff of the event's editable fields — only the ones being proposed for change.
 * The field names and value shapes match EventRequestFormValues, so one definition of
 * "what a requirement looks like" covers the request form, the change form and the review.
 *
 * A requirement field present here is a complete replacement for the stored list, never a
 * delta: the organiser ticks the set they want to end up with. That is what lets the
 * review RPC apply an approved field by assignment, with no merge rules to get wrong.
 */
export type ProposedEventChanges = Partial<{
  name: string
  purpose: string
  eventType: string
  description: string
  proposedStart: string
  proposedEnd: string
  expectedAttendance: string
  programme: string
  layoutPreference: string
  accessibilityRequirements: string[]
  facilityRequirements: string[]
  equipmentRequirements: string[]
  registrationRequired: boolean
  specialArrangements: string
}>

export interface ChangeRequestReviewHistoryEntry {
  id: string
  requestVersion: number
  outcome: Exclude<ChangeRequestStatus, 'submitted' | 'withdrawn'>
  proposedChanges: ProposedEventChanges
  fieldDecisions: ChangeRequestFieldDecision[]
  reviewNote: string | null
  reviewerName: string
  reviewedAt: string
}

export interface EventChangeRequest {
  reviewHistory?: ChangeRequestReviewHistoryEntry[]
  reviewVersion?: number
  replyHistory?: ChangeRequestReplyRound[]
  id: string
  eventId: string
  proposedChanges: ProposedEventChanges
  reason: string
  status: ChangeRequestStatus
  submittedAt: string
  reviewedAt: string | null
  reviewNote: string | null
  fieldDecisions: ChangeRequestFieldDecision[]
}

/** One database snapshot: the comparison and its version must always travel together. */
export interface ChangeRequestReviewContext {
  eventId: string
  eventStatus: EventStatus
  eventUpdatedAt: string
  currentValues: EventRequestInput
  requests: EventChangeRequest[]
}

/** Review preparation; persistence is handled by the database review operation. */
export interface ChangeRequestFieldDecision {
  field: keyof ProposedEventChanges
  decision: 'approved' | 'rejected' | 'clarification_requested'
  note: string
}

export type PreparedChangeRequestReview =
  | {
      status: 'approved' | 'partially_approved' | 'rejected' | 'clarification_requested'
      decisions: ChangeRequestFieldDecision[]
      approvedChanges: ProposedEventChanges
    }
  | {
      status: 'clarification_requested'
      note: string
      approvedChanges: ProposedEventChanges
    }

export type ChangeRequestReviewValidationResult =
  | { ok: true; review: PreparedChangeRequestReview }
  | { ok: false; reason: string }