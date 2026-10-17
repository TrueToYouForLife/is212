/** US15: what an Attendee sees of an event and of their own registrations. Public fields only. */

export interface OpenEvent {
  id: string
  name: string
  eventType: string | null
  start: string
  end: string | null
  /** "Venue (Location)" from confirmed venue bookings, or null while none is confirmed. */
  venue: string | null
  /** Whether the signed-in Attendee already has an active registration for it. */
  registered: boolean
}

/** US16: the Attendee's own place in a full event's queue. 'expired' is an offer that has lapsed. */
export type WaitlistStatus = 'waiting' | 'offered' | 'expired'

export interface WaitlistState {
  entryId: string
  status: WaitlistStatus
  /** 1-based place among those still waiting; null once offered or expired. */
  position: number | null
  /** When an offer lapses; null while only waiting. */
  offerExpiresAt: string | null
}

export interface OpenEventDetails extends OpenEvent {
  description: string | null
  programme: string | null
  prerequisites: string | null
  /** No place left, or people already queued: register is replaced by the waiting list (US16). */
  full: boolean
  /** The signed-in Attendee's active waiting-list entry for this event, if any. */
  waitlist: WaitlistState | null
}

/** One row of "Waiting lists" on My registrations (US16). */
export interface MyWaitlistEntry extends WaitlistState {
  eventId: string
  eventName: string
  start: string
  venue: string | null
}

// The only statuses a registered event can reach (0004: confirmed -> completed | cancelled).
export type AttendeeEventStatus = 'confirmed' | 'completed' | 'cancelled'
export type RegistrationStatus = 'registered' | 'withdrawn'

export const EVENT_STATUS_LABELS: Record<AttendeeEventStatus, string> = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: 'Registered',
  withdrawn: 'Withdrawn',
}

export interface MyRegistration {
  registrationId: string
  eventId: string
  eventName: string
  start: string
  end: string | null
  venue: string | null
  eventStatus: AttendeeEventStatus
  eventStatusLabel: string
  registrationStatus: RegistrationStatus
  registrationStatusLabel: string
}

/** US23: the Attendee's own withdrawal, as the rows the page shows (see canWithdraw). */
export type WithdrawableRegistration = Pick<MyRegistration, 'registrationStatus' | 'eventStatus' | 'start'>

/** What the Attendee enters to register (US15 D9). */
export interface RegistrationAnswers {
  phone: string
  dietaryRequirements: string | null
  accessibilityNeeds: string | null
  prerequisitesConfirmed: boolean
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; reason: string }

/** US16 SCRUM-154: one row of the waiting list as the assigned Coordinator sees it. */
export type ManagedWaitlistStatus = 'waiting' | 'offered' | 'expired'
export type WaitlistMove = 'front' | 'up' | 'down'

export interface ManagedWaitlistEntry {
  entryId: string
  attendeeName: string
  status: ManagedWaitlistStatus
  /** 1-based place in the queue; null for someone who already holds an offered place. */
  position: number | null
  joinedAt: string
  offerExpiresAt: string | null
}
