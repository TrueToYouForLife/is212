import type { EquipmentReturns, ReturnAllocation, ReturnInspectionHistory, ReturnInspectionResult } from '../../equipmentReturnService'
import type { ReturnInspectionInput } from '../../equipmentReturnValidation'

export function returnId(n: number) { return `24000000-0000-4000-8000-${String(n).padStart(12, '0')}` }
export const allocation: ReturnAllocation = {
  allocationId: returnId(1), eventId: returnId(10), eventReference: 'EVT-24', eventName: 'Open day',
  itemId: returnId(20), assetTag: 'P-24', typeName: 'Projector', collectionDate: '2026-10-24', returnDate: '2026-10-26',
  allocationStatus: 'reserved', operationalStatus: 'operational', statusVersion: 0, version: 'a'.repeat(32),
  lastFinding: null, lastInspectedAt: null,
}
export const anotherAllocation: ReturnAllocation = { ...allocation, allocationId: returnId(2), assetTag: 'P-25', itemId: returnId(21) }
export const inspection: ReturnInspectionHistory = { ...allocation,
  allocationId: returnId(4), itemId: returnId(22), assetTag: 'LEGACY-24', operationalStatus: 'retired',
  inspectionId: returnId(30), inspectionVersion: 1, finding: 'good', description: 'Checked case and cable',
  previousStatus: 'retired', resultingStatus: 'retired', inspectedStatusVersion: 0,
  statusChangeId: null, defectReportId: null, inspectedBy: returnId(40), inspectedByName: 'Stored staff name',
  inspectedAt: '2026-10-26T16:15:00+00:00', lastFinding: 'good', lastInspectedAt: '2026-10-26T16:15:00+00:00',
}
export function returnsData(overrides: Partial<EquipmentReturns> = {}): EquipmentReturns {
  return { out: [{ ...allocation, allocationId: returnId(3), eventId: returnId(11), eventName: 'Another event',
    collectionDate: '2026-10-27', returnDate: '2026-10-29' }],
  pendingChecks: [allocation, anotherAllocation], history: [inspection], ...overrides }
}
export const inspectionInput: ReturnInspectionInput = {
  allocationId: allocation.allocationId, version: allocation.version, currentStatus: 'operational', statusVersion: 0,
  finding: 'damage', description: '  Cracked lens  ', targetStatus: 'needs_repair',
}
export function inspectionReceipt(overrides: Partial<ReturnInspectionResult> = {}): ReturnInspectionResult {
  return { inspectionId: returnId(31), allocationId: allocation.allocationId, inspectionVersion: 1,
    finding: 'damage', resolved: true, status: 'needs_repair', statusVersion: 1, statusChanged: true, reviewCount: 1, ...overrides }
}
