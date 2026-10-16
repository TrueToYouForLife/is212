import { supabase } from '../../lib/supabase'
import { validateRequirement } from './validation'
import {
  REQUIREMENT_COLUMNS, toEventRequirements, toNotification, toRequirement, toTechSupportRequirement,
} from './equipmentRows'
import type { EventRow, NotificationRow, RequirementRow, TechSupportRow } from './equipmentRows'
import type {
  EquipmentNotification, EquipmentRequirement, EquipmentType, EventRequirements,
  RequirementFormInput, ServiceResult, TechSupportRequirement,
} from './types'

export const EQUIPMENT_SERVICE_MESSAGES = {
  forbidden: 'Only the assigned Event Coordinator can change equipment requirements.',
  notEligible: 'Equipment requirements can only be changed for approved events.',
  typeMissing: 'That equipment type is no longer in the catalogue.',
  invalid: 'Check the highlighted fields.',
  loadFailed: 'Equipment requirements could not be loaded. Reload to try again.',
  catalogueFailed: 'The equipment catalogue could not be loaded. Reload to try again.',
  notificationsFailed: 'Equipment notifications could not be loaded. Reload to try again.',
  saveFailed: 'The change could not be confirmed. Reload to check it before trying again.',
} as const

const TABLE = 'event_equipment_requirements'

interface DatabaseError { code?: string }
type WritableFields = { type_id: string; quantity: number; technical_notes: string | null; essential: boolean }

/** Database detail stays private; each refusal maps to what the user can act on. */
function writeFailure(error: DatabaseError): string {
  switch (error.code) {
    case '42501': return EQUIPMENT_SERVICE_MESSAGES.forbidden
    // RLS hides rows the caller may not change, so .single() finds none (PGRST116).
    case 'PGRST116': return EQUIPMENT_SERVICE_MESSAGES.forbidden
    case '22000': return EQUIPMENT_SERVICE_MESSAGES.notEligible
    case '23503': return EQUIPMENT_SERVICE_MESSAGES.typeMissing
    default: return EQUIPMENT_SERVICE_MESSAGES.saveFailed
  }
}

/** Runs a read and maps it; any error or thrown failure becomes the one given message. */
async function read<Row, T>(
  query: () => PromiseLike<{ data: unknown; error: unknown }>, map: (row: Row) => T, failure: string,
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await query()
    if (error || !data) return { ok: false, reason: failure }
    return { ok: true, data: map(data as Row) }
  } catch {
    return { ok: false, reason: failure }
  }
}

export function loadEventRequirements(eventId: string): Promise<ServiceResult<EventRequirements>> {
  return read<EventRow, EventRequirements>(() => supabase
    .from('events')
    .select(`id, reference, name, status, coordinator_id, equipment_requirements, ${TABLE}(${REQUIREMENT_COLUMNS})`)
    .eq('id', eventId)
    .maybeSingle(), toEventRequirements, EQUIPMENT_SERVICE_MESSAGES.loadFailed)
}

export function loadCatalogue(): Promise<ServiceResult<EquipmentType[]>> {
  // Grouping by category keeps related equipment together in the picker.
  return read<EquipmentType[], EquipmentType[]>(() => supabase.from('equipment_types').select('id, name, category'),
    (types) => [...types].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    EQUIPMENT_SERVICE_MESSAGES.catalogueFailed)
}

export function loadAllRequirements(): Promise<ServiceResult<TechSupportRequirement[]>> {
  return read<TechSupportRow[], TechSupportRequirement[]>(() => supabase
    .from(TABLE)
    .select(`${REQUIREMENT_COLUMNS}, events(reference, name, proposed_start, proposed_end)`),
  (rows) => rows.map(toTechSupportRequirement), EQUIPMENT_SERVICE_MESSAGES.loadFailed)
}

/** RLS limits the rows to the signed-in Technical Support user's own notifications. */
export function loadMyEquipmentNotifications(): Promise<ServiceResult<EquipmentNotification[]>> {
  return read<NotificationRow[], EquipmentNotification[]>(() => supabase
    .from('equipment_requirement_notifications')
    .select('id, action, event_id, type_name, quantity, created_at, events(reference)'),
  (rows) => rows.map(toNotification).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  EQUIPMENT_SERVICE_MESSAGES.notificationsFailed)
}

/** Validates first so invalid input never reaches Supabase. Status, the reservation link
 * and the creator are never sent; the database sets them and refuses them from a browser. */
async function saveRequirement(
  input: RequirementFormInput,
  catalogue: EquipmentType[],
  write: (fields: WritableFields) => PromiseLike<{ data: unknown; error: DatabaseError | null }>,
): Promise<ServiceResult<EquipmentRequirement>> {
  const validation = validateRequirement(input, catalogue)
  if (!validation.ok) return { ok: false, reason: EQUIPMENT_SERVICE_MESSAGES.invalid, errors: validation.errors }
  const { typeId, quantity, technicalNotes, essential } = validation.value
  try {
    const { data, error } = await write({ type_id: typeId, quantity, technical_notes: technicalNotes, essential })
    if (error) return { ok: false, reason: writeFailure(error) }
    if (!data) return { ok: false, reason: EQUIPMENT_SERVICE_MESSAGES.saveFailed }
    return { ok: true, data: toRequirement(data as RequirementRow) }
  } catch {
    // An uncertain write is not retried: the user reloads to see what was saved.
    return { ok: false, reason: EQUIPMENT_SERVICE_MESSAGES.saveFailed }
  }
}

export function addRequirement(
  eventId: string, input: RequirementFormInput, catalogue: EquipmentType[],
): Promise<ServiceResult<EquipmentRequirement>> {
  return saveRequirement(input, catalogue, (fields) =>
    supabase.from(TABLE).insert({ event_id: eventId, ...fields }).select(REQUIREMENT_COLUMNS).single())
}

export function updateRequirement(
  requirementId: string, input: RequirementFormInput, catalogue: EquipmentType[],
): Promise<ServiceResult<EquipmentRequirement>> {
  return saveRequirement(input, catalogue, (fields) =>
    supabase.from(TABLE).update(fields).eq('id', requirementId).select(REQUIREMENT_COLUMNS).single())
}

/** Releasing reserved units happens in the database, in the same transaction as the delete. */
export async function removeRequirement(requirementId: string): Promise<ServiceResult<null>> {
  try {
    const { data, error } = await supabase.from(TABLE).delete().eq('id', requirementId).select('id')
    if (error) return { ok: false, reason: writeFailure(error) }
    // RLS turns "not yours" into zero deleted rows rather than an error.
    if (!Array.isArray(data) || data.length === 0) return { ok: false, reason: EQUIPMENT_SERVICE_MESSAGES.forbidden }
    return { ok: true, data: null }
  } catch {
    return { ok: false, reason: EQUIPMENT_SERVICE_MESSAGES.saveFailed }
  }
}
