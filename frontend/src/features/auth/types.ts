export const USER_ROLES = [
  'organiser',
  'coordinator',
  'coordinator_lead',
  'operations_manager',
  'venue_staff',
  'tech_support',
  'safety_officer',
  'attendee',
] as const

export type UserRole = (typeof USER_ROLES)[number]

// Database role keys are lowercase; labels are presentation only.
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  organiser: 'Event Organiser',
  coordinator: 'Event Coordinator',
  coordinator_lead: 'Coordinator Lead',
  operations_manager: 'Event Operations Manager',
  venue_staff: 'Venue Staff',
  tech_support: 'Technical Support',
  safety_officer: 'Safety Officer',
  attendee: 'Attendee',
}

/** Narrows an arbitrary database string to a role we know how to render. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/** The slice of the Supabase session the app actually needs. */
export interface AppSession {
  userId: string
  email: string | null
}

export interface UserProfile {
  id: string
  fullName: string
  role: UserRole
}

export type AuthResult = { ok: true } | { ok: false; reason: string }

/** Where a new Attendee lands after sign-up: the events open for registration (AC-029.4). */
export const SIGN_UP_LANDING_PATH = '/events/open'

export interface SignUpInput {
  fullName: string
  email: string
  password: string
}

export type SignUpResult =
  | { ok: true; signedIn: boolean }
  | { ok: false; reason: string; duplicate?: boolean }
