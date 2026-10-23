import { z } from 'zod'
import { supabase } from '../../lib/supabase'

const catalogue = z.object({
  types: z.array(z.object({
    id: z.string().uuid(), name: z.string(), category: z.string(), description: z.string().nullable(),
    totalUnits: z.number().int().nonnegative(), usableUnits: z.number().int().nonnegative(),
  })),
  units: z.array(z.object({
    id: z.string().uuid(), typeId: z.string().uuid(), assetTag: z.string(),
    locationId: z.string().uuid(), locationName: z.string(), locationDescription: z.string(),
    status: z.enum(['operational', 'needs_repair', 'under_repair', 'retired', 'missing', 'unavailable']),
  })),
})
export type EquipmentCatalogue = z.infer<typeof catalogue>
export type EquipmentUnitStatus = EquipmentCatalogue['units'][number]['status']
export const CATALOGUE_LOAD_ERROR = 'The equipment catalogue could not be loaded. Please try again.'

export async function loadEquipmentCatalogue(): Promise<
  { ok: true; data: EquipmentCatalogue } | { ok: false; reason: string }
> {
  try {
    const { data, error } = await supabase.rpc('get_equipment_catalogue')
    const parsed = catalogue.safeParse(data)
    if (error || !parsed.success) return { ok: false, reason: CATALOGUE_LOAD_ERROR }
    return { ok: true, data: parsed.data }
  } catch { return { ok: false, reason: CATALOGUE_LOAD_ERROR } }
}
