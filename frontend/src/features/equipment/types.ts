import type { UserRole } from '../auth/types'
import type { EventStatus } from '../events/types'

// Stored values. Only the database and reservation work (US14) set them; the Coordinator
// never does, which is why the browser has no column grant on status.
export const REQUIREMENT_STATUSES = ['pending_review', 'reserved', 'partially_reserved', 'unavailable'] as const
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]

// Non-essential is derived from the Coordinator's essential flag, not stored as a status.
export type RequirementDisplayStatus = RequirementStatus | 'non_essential'

export interface EquipmentType {
  id: string
  name: string
  category: string
}

export interface EquipmentRequirement {
  id: string
  eventId: string
  typeId: string
  typeName: string
  quantity: number
  technicalNotes: string | null
  essential: boolean
  status: RequirementStatus
  displayStatus: RequirementDisplayStatus
}

export interface RequirementEvent {
  id: string
  reference: string | null
  name: string | null
  status: EventStatus
  coordinatorId: string | null
  /** The Organiser's original free-text equipment needs, shown for reference. */
  organiserEquipment: string | null
}

export interface EventRequirements {
  event: RequirementEvent
  requirements: EquipmentRequirement[]
}

/** What the editor form holds. Quantity arrives as text from the input. */
export interface RequirementFormInput {
  typeId: string
  quantity: string | number
  technicalNotes?: string | null
  essential?: boolean
}

/** Validated values: the only fields the Coordinator may write. */
export interface RequirementInput {
  typeId: string
  quantity: number
  technicalNotes: string | null
  essential: boolean
}

export type RequirementField = 'typeId' | 'quantity'
export type RequirementFieldErrors = Partial<Record<RequirementField, string>>

export type RequirementValidationResult =
  | { ok: true; value: RequirementInput }
  | { ok: false; errors: RequirementFieldErrors }

export interface Viewer {
  id: string
  role: UserRole
}

export interface TechSupportRequirement extends EquipmentRequirement {
  eventReference: string | null
  eventName: string | null
  eventStart: string | null
  eventEnd: string | null
}

export type EquipmentNotificationAction = 'added' | 'changed' | 'removed'

export interface EquipmentNotification {
  id: string
  action: EquipmentNotificationAction
  eventId: string
  eventReference: string | null
  typeName: string
  quantity: number
  createdAt: string
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; errors?: RequirementFieldErrors }
