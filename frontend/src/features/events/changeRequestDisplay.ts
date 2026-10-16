import type { ChangeRequestStatus, ProposedEventChanges } from './types'

export const CHANGE_FIELD_LABELS: Record<keyof ProposedEventChanges, string> = {
  name: 'Event name', purpose: 'Purpose', eventType: 'Type of event', description: 'Description',
  proposedStart: 'Preferred start', proposedEnd: 'Preferred end', expectedAttendance: 'Expected attendance',
  programme: 'Programme', layoutPreference: 'Room layout', accessibilityRequirements: 'Accessibility',
  equipmentRequirements: 'Equipment', registrationRequired: 'Registration required',
  specialArrangements: 'Special arrangements',
}

export const CHANGE_STATUS_LABELS: Record<ChangeRequestStatus, string> = {
  submitted: 'In review', clarification_requested: 'Clarification required',
  approved: 'Approved', rejected: 'Rejected', partially_approved: 'Partially approved', withdrawn: 'Withdrawn',
}

/** Interpret datetime-local proposals in Singapore time, matching the review RPC. */
export function formatChangeValue(field: keyof ProposedEventChanges, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === undefined || value === null || String(value).trim() === '') return 'Not provided'
  if (field === 'proposedStart' || field === 'proposedEnd') {
    const raw = String(value)
    const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}+08:00`)
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short',
    }).format(date) + ' SGT'
  }
  return String(value)
}
