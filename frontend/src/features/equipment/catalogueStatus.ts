import type { EquipmentUnitStatus } from './equipmentCatalogueService'

export const catalogueStatusOptions = ['Operational', 'Damaged', 'Under Maintenance', 'Unavailable'] as const
export function catalogueStatusGroup(status: EquipmentUnitStatus): string {
  if (status === 'operational') return 'Operational'
  if (status === 'needs_repair') return 'Damaged'
  if (status === 'under_repair') return 'Under Maintenance'
  return 'Unavailable'
}
export function catalogueStatusLabel(status: EquipmentUnitStatus): string {
  // Retain the reason older units are unavailable instead of rewriting their history.
  if (status === 'retired') return 'Unavailable (retired)'
  if (status === 'missing') return 'Unavailable (missing)'
  return catalogueStatusGroup(status)
}
