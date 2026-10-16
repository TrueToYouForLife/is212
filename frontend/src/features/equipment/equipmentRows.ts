import type { EventStatus } from '../events/types'
import { requirementDisplayStatus } from './validation'
import type {
  EquipmentNotification, EquipmentNotificationAction, EquipmentRequirement, EventRequirements,
  RequirementStatus, TechSupportRequirement,
} from './types'

// Pure mapping from database rows to app objects. Kept apart from the service so the
// service reads as "which query, which refusal" and this file as "which shape".

/** Without generated database types, supabase-js types every embed as an array, but a
 * many-to-one embed arrives as a single object. Accepting both keeps the casts honest. */
type Embedded<T> = T | T[] | null
function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export const REQUIREMENT_COLUMNS =
  'id, event_id, type_id, quantity, technical_notes, essential, status, equipment_types(name)'

export interface RequirementRow {
  id: string
  event_id: string
  type_id: string
  quantity: number
  technical_notes: string | null
  essential: boolean
  status: RequirementStatus
  equipment_types: Embedded<{ name: string }>
}
export interface EventRow {
  id: string
  reference: string | null
  name: string | null
  status: EventStatus
  coordinator_id: string | null
  equipment_requirements: string | null
  event_equipment_requirements: RequirementRow[] | null
}
export interface TechSupportRow extends RequirementRow {
  events: Embedded<{ reference: string | null; name: string | null; proposed_start: string | null; proposed_end: string | null }>
}
export interface NotificationRow {
  id: string
  action: EquipmentNotificationAction
  event_id: string
  type_name: string
  quantity: number
  created_at: string
  events: Embedded<{ reference: string | null }>
}

export function toRequirement(row: RequirementRow): EquipmentRequirement {
  return {
    id: row.id,
    eventId: row.event_id,
    typeId: row.type_id,
    typeName: one(row.equipment_types)?.name ?? 'Unknown equipment',
    quantity: row.quantity,
    technicalNotes: row.technical_notes,
    essential: row.essential,
    status: row.status,
    displayStatus: requirementDisplayStatus(row.status, row.essential),
  }
}

export function toEventRequirements(row: EventRow): EventRequirements {
  return {
    event: {
      id: row.id, reference: row.reference, name: row.name, status: row.status,
      coordinatorId: row.coordinator_id, organiserEquipment: row.equipment_requirements,
    },
    requirements: (row.event_equipment_requirements ?? []).map(toRequirement),
  }
}

export function toTechSupportRequirement(row: TechSupportRow): TechSupportRequirement {
  const event = one(row.events)
  return {
    ...toRequirement(row),
    eventReference: event?.reference ?? null,
    eventName: event?.name ?? null,
    eventStart: event?.proposed_start ?? null,
    eventEnd: event?.proposed_end ?? null,
  }
}

export function toNotification(row: NotificationRow): EquipmentNotification {
  return {
    id: row.id,
    action: row.action,
    eventId: row.event_id,
    eventReference: one(row.events)?.reference ?? null,
    typeName: row.type_name,
    quantity: row.quantity,
    createdAt: row.created_at,
  }
}
