import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, describeCodes } from './requirementCatalogue'
import type { FeatureOption } from './requirementCatalogue'
import type { ChangeRequestStatus, ProposedEventChanges } from './types'

export const CHANGE_FIELD_LABELS: Record<keyof ProposedEventChanges, string> = {
  name: 'Event name', purpose: 'Purpose', eventType: 'Type of event', description: 'Description',
  proposedStart: 'Preferred start', proposedEnd: 'Preferred end', expectedAttendance: 'Expected attendance',
  programme: 'Programme', layoutPreference: 'Room layout', accessibilityRequirements: 'Accessibility',
  facilityRequirements: 'Venue facilities',
  equipmentRequirements: 'Equipment', registrationRequired: 'Registration required',
  specialArrangements: 'Special arrangements',
}

export const CHANGE_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  submitted: 'In review', clarification_requested: 'Clarification required',
  approved: 'Approved', rejected: 'Rejected', partially_approved: 'Partially approved', withdrawn: 'Withdrawn',
}

/** Which proposed fields hold a code list, so one place decides how they are read back. */
const CODE_LIST_LABELS: Partial<Record<keyof ProposedEventChanges, readonly FeatureOption[]>> = {
  accessibilityRequirements: ACCESSIBILITY_OPTIONS,
  facilityRequirements: FACILITY_OPTIONS,
}

/**
 * Interpret datetime-local proposals in Singapore time, matching the review RPC.
 *
 * Requirement fields are code lists. An empty list is a real proposal — "remove every
 * accessibility requirement" — and must not read as "Not provided", or a reviewer cannot
 * tell the difference between dropping the requirements and never having asked.
 *
 * Layout and equipment codes are shown as codes unless the caller passes the loaded
 * options: this module is pure, so it cannot read layout_types or equipment_types.
 */
export function formatChangeValue(
  field: keyof ProposedEventChanges,
  value: unknown,
  options: { layouts?: readonly FeatureOption[]; equipment?: readonly FeatureOption[] } = {},
): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  if (Array.isArray(value)) {
    const codes = value.map(String)
    if (codes.length === 0) return 'None'
    const catalogue = field === 'equipmentRequirements'
      ? (options.equipment ?? [])
      : (CODE_LIST_LABELS[field] ?? [])
    return describeCodes(catalogue, codes)
  }

  if (value === undefined || value === null || String(value).trim() === '') return 'Not provided'

  if (field === 'layoutPreference') {
    const layouts = options.layouts ?? []
    const match = layouts.find((option) => option.code === value)
    return match ? match.label : String(value)
  }

  if (field === 'proposedStart' || field === 'proposedEnd') {
    const raw = String(value)
    const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+08:00`)
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short',
    }).format(date) + ' SGT'
  }
  return String(value)
}
