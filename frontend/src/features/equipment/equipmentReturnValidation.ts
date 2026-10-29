import { z } from 'zod'
import { equipmentStatusTargets } from './equipmentStatusValidation'

export const returnFindings = ['good', 'defect', 'damage', 'missing', 'other'] as const
export const returnFindingLabels: Record<typeof returnFindings[number], string> = {
  good: 'No issues', defect: 'Defect', damage: 'Damage', missing: 'Missing / not returned', other: 'Other',
}
export const returnOperationalStatuses = [...equipmentStatusTargets, 'retired', 'missing'] as const
export const returnInspectionInput = z.object({
  allocationId: z.string().uuid(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
  currentStatus: z.enum(returnOperationalStatuses),
  statusVersion: z.number().int().nonnegative().safe(),
  finding: z.enum(returnFindings),
  description: z.string().trim(),
  targetStatus: z.enum(['', ...equipmentStatusTargets]),
}).superRefine((value, context) => {
  if (value.finding !== 'good' && !value.description) {
    context.addIssue({ code: 'custom', path: ['description'], message: 'Describe the issue found during inspection.' })
  }
  if (value.finding !== 'good' && value.finding !== 'missing' && !value.targetStatus) {
    context.addIssue({ code: 'custom', path: ['targetStatus'], message: 'Choose the resulting operational status.' })
  }
  if (value.finding === 'missing' && value.targetStatus && value.targetStatus !== 'unavailable') {
    context.addIssue({ code: 'custom', path: ['targetStatus'], message: 'Missing equipment must remain Unavailable.' })
  }
  if (value.finding === 'good' && value.targetStatus && value.targetStatus !== value.currentStatus && !value.description) {
    context.addIssue({ code: 'custom', path: ['description'], message: 'Enter a reason for changing the operational status.' })
  }
})
export type ReturnInspectionInput = z.infer<typeof returnInspectionInput>
export function inspectionResultingStatus(value: ReturnInspectionInput) {
  return value.finding === 'missing' ? 'unavailable' : value.targetStatus || value.currentStatus
}
