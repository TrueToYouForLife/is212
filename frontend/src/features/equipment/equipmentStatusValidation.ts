import { z } from 'zod'

export const equipmentStatusTargets = ['operational', 'needs_repair', 'under_repair', 'unavailable'] as const
export const equipmentStatusInput = z.object({
  itemId: z.string().uuid(),
  status: z.enum(equipmentStatusTargets),
  note: z.string().trim().min(1, 'Enter a reason for this status change.'),
  version: z.number().int().nonnegative().safe(),
})
export type EquipmentStatusInput = z.infer<typeof equipmentStatusInput>
