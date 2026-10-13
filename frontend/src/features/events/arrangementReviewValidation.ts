import { z } from 'zod'

export const arrangementResolutionSchema = z.object({
  flagId: z.string().uuid(),
  method: z.enum(['corrected', 'confirmed_valid']),
  note: z.string().trim().min(1),
})
export type ArrangementResolutionMethod = z.infer<typeof arrangementResolutionSchema>['method']
