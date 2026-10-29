import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { inspectionResultingStatus, returnFindings, returnInspectionInput, returnOperationalStatuses, type ReturnInspectionInput } from './equipmentReturnValidation'

const status = z.enum(returnOperationalStatuses)
const count = z.number().int().nonnegative().safe()
const date = z.string().date()
const instant = z.string().datetime({ offset: true })
const row = z.object({
  allocationId: z.string().uuid(), eventId: z.string().uuid(), eventReference: z.string().nullable(),
  eventName: z.string().nullable(), itemId: z.string().uuid(), assetTag: z.string(), typeName: z.string(),
  collectionDate: date, returnDate: date, allocationStatus: z.enum(['reserved', 'checked_out', 'returned', 'cancelled']),
  operationalStatus: status, statusVersion: count, version: z.string().regex(/^[a-f0-9]{32}$/),
  lastFinding: z.enum(returnFindings).nullable(), lastInspectedAt: instant.nullable(),
})
export type ReturnAllocation = z.infer<typeof row>
const history = row.extend({
  inspectionId: z.string().uuid(), inspectionVersion: count.positive(), finding: z.enum(returnFindings),
  description: z.string().nullable(), previousStatus: status, resultingStatus: status,
  inspectedStatusVersion: count, statusChangeId: z.string().uuid().nullable(), defectReportId: z.string().uuid().nullable(),
  inspectedBy: z.string().uuid(), inspectedByName: z.string(), inspectedAt: instant,
}).refine(value => value.finding === 'good'
  ? value.defectReportId === null
  : value.defectReportId !== null && Boolean(value.description?.trim()))
  .refine(value => value.finding !== 'missing' || value.resultingStatus === 'unavailable')
const queue = z.object({ out: z.array(row), pendingChecks: z.array(row), history: z.array(history) })
  .refine(value => {
    const work = [...value.out, ...value.pendingChecks]
    return new Set(work.map(item => item.allocationId)).size === work.length
      && new Set(value.history.map(item => item.inspectionId)).size === value.history.length
      && [...work, ...value.history].every(item => item.collectionDate <= item.returnDate
        && (item.lastFinding === null) === (item.lastInspectedAt === null))
      && value.out.every(item => item.allocationStatus !== 'cancelled' && item.lastFinding === null)
      && value.pendingChecks.every(item => item.allocationStatus !== 'cancelled'
        && (item.lastFinding === null || item.lastFinding === 'missing'))
  })
export type EquipmentReturns = z.infer<typeof queue>
export type ReturnInspectionHistory = EquipmentReturns['history'][number]
const receipt = z.object({
  inspectionId: z.string().uuid(), allocationId: z.string().uuid(), inspectionVersion: count.positive(),
  finding: z.enum(returnFindings), resolved: z.boolean(), status, statusVersion: count,
  statusChanged: z.boolean(), reviewCount: count,
})
export type ReturnInspectionResult = z.infer<typeof receipt>
export const EQUIPMENT_RETURN_MESSAGES = {
  load: 'Equipment returns could not be loaded. Please reload the list.',
  invalid: 'Check the findings and resulting status. Describe any issue or status change.',
  forbidden: 'Only Technical Support Staff can inspect equipment returns. Check your access and reload.',
  stale: 'The equipment or allocation changed. Your findings are kept; reload and review the current details before saving again.',
  ineligible: 'This allocation may no longer need inspection, or its return date has changed. Your findings are kept; reload before trying again.',
  failed: 'The save result could not be confirmed. Your findings are kept; reload before trying again.',
} as const
type Result<T> = { ok: true; data: T } | { ok: false; reason: string }

export async function loadEquipmentReturns(): Promise<Result<EquipmentReturns>> {
  try {
    const { data, error } = await supabase.rpc('get_equipment_return_inspections')
    if (error) return { ok: false, reason: error.code === '42501' ? EQUIPMENT_RETURN_MESSAGES.forbidden : EQUIPMENT_RETURN_MESSAGES.load }
    const parsed = queue.safeParse(data)
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: EQUIPMENT_RETURN_MESSAGES.load }
  } catch { return { ok: false, reason: EQUIPMENT_RETURN_MESSAGES.load } }
}

export async function saveReturnInspection(input: ReturnInspectionInput): Promise<Result<ReturnInspectionResult>> {
  const parsed = returnInspectionInput.safeParse(input)
  if (!parsed.success) return { ok: false, reason: EQUIPMENT_RETURN_MESSAGES.invalid }
  const value = parsed.data
  try {
    const { data, error } = await supabase.rpc('inspect_equipment_return', {
      p_allocation: value.allocationId, p_version: value.version, p_finding: value.finding,
      p_description: value.description || null,
      p_status: value.finding === 'missing' ? 'unavailable' : value.targetStatus || null,
    })
    if (error) return { ok: false, reason: error.code === '42501' ? EQUIPMENT_RETURN_MESSAGES.forbidden
      : error.code === '40001' ? EQUIPMENT_RETURN_MESSAGES.stale
        : error.code === '22023' ? EQUIPMENT_RETURN_MESSAGES.ineligible : EQUIPMENT_RETURN_MESSAGES.failed }
    const result = receipt.safeParse(data)
    const expectedStatus = inspectionResultingStatus(value)
    return result.success && result.data.allocationId === value.allocationId && result.data.finding === value.finding
      && result.data.resolved === (value.finding !== 'missing') && result.data.status === expectedStatus
      && result.data.statusChanged === (expectedStatus !== value.currentStatus)
      && result.data.statusVersion === value.statusVersion + (result.data.statusChanged ? 1 : 0)
      && (result.data.statusChanged || result.data.reviewCount === 0)
      ? { ok: true, data: result.data } : { ok: false, reason: EQUIPMENT_RETURN_MESSAGES.failed }
  } catch { return { ok: false, reason: EQUIPMENT_RETURN_MESSAGES.failed } }
}
