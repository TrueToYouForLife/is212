import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { equipmentStatusInput, equipmentStatusTargets, type EquipmentStatusInput } from './equipmentStatusValidation'

const status = z.enum(['operational', 'needs_repair', 'under_repair', 'unavailable', 'retired', 'missing'])
const details = z.object({
  id: z.string().uuid(), assetTag: z.string(), status, version: z.number().int().nonnegative().safe(),
  history: z.array(z.object({
    id: z.string().uuid(), previousStatus: status, newStatus: z.enum(equipmentStatusTargets), note: z.string(),
    changedBy: z.string().uuid(), changedByName: z.string(), changedAt: z.string().datetime({ offset: true }),
    version: z.number().int().positive().safe(),
  })),
})
export type EquipmentStatusDetails = z.infer<typeof details>
const saved = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative().safe(),
  changed: z.boolean(), reviewCount: z.number().int().nonnegative(),
})
export type EquipmentStatusResult = z.infer<typeof saved>
export const EQUIPMENT_STATUS_MESSAGES = {
  load: 'Equipment status and history could not be loaded. Please reload the unit.',
  invalid: 'Choose a status and enter a reason. Reload the unit if its details are unavailable.',
  forbidden: 'Only Technical Support Staff can manage equipment status. Check your access and reload.',
  stale: 'This equipment unit changed. Your note is kept; reload the unit and review its current status before saving again.',
  failed: 'The save result could not be confirmed. Your note is kept; reload the unit before trying again.',
} as const

export async function loadEquipmentStatus(itemId: string): Promise<
  { ok: true; data: EquipmentStatusDetails } | { ok: false; reason: string }
> {
  if (!z.string().uuid().safeParse(itemId).success) return { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.load }
  try {
    const { data, error } = await supabase.rpc('get_equipment_status', { p_item: itemId })
    if (error) return { ok: false, reason: error.code === '42501' ? EQUIPMENT_STATUS_MESSAGES.forbidden : EQUIPMENT_STATUS_MESSAGES.load }
    const parsed = details.safeParse(data)
    return parsed.success && parsed.data.id === itemId ? { ok: true, data: parsed.data }
      : { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.load }
  } catch { return { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.load } }
}

export async function saveEquipmentStatus(input: EquipmentStatusInput): Promise<
  { ok: true; data: EquipmentStatusResult } | { ok: false; reason: string }
> {
  const parsed = equipmentStatusInput.safeParse(input)
  if (!parsed.success) return { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.invalid }
  try {
    const value = parsed.data
    const { data, error } = await supabase.rpc('set_equipment_status', {
      p_item: value.itemId, p_status: value.status, p_note: value.note, p_version: value.version,
    })
    if (error) return { ok: false, reason: error.code === '42501' ? EQUIPMENT_STATUS_MESSAGES.forbidden
      : error.code === '40001' ? EQUIPMENT_STATUS_MESSAGES.stale
        : error.code === '22023' ? EQUIPMENT_STATUS_MESSAGES.invalid : EQUIPMENT_STATUS_MESSAGES.failed }
    const result = saved.safeParse(data)
    return result.success && result.data.id === value.itemId
      && result.data.version === value.version + (result.data.changed ? 1 : 0)
      ? { ok: true, data: result.data } : { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.failed }
  } catch { return { ok: false, reason: EQUIPMENT_STATUS_MESSAGES.failed } }
}
