import { formatDateTime } from '../formatters'
import type { AuditEntry } from './types'

const ACTION_TITLES: Record<string, string> = {
  submitted: 'Request submitted',
  approved: 'Request approved',
  rejected: 'Request rejected',
  confirmed: 'Event confirmed',
  cancelled: 'Event cancelled',
  status_changed: 'Status changed',
  coordinator_assigned: 'Coordinator assigned or changed',
  rescheduled: 'Event rescheduled',
  details_changed: 'Details changed',
  venue_booking_decided: 'Venue booking decision',
  equipment_reservation_changed: 'Equipment reservation changed',
}

const FIELD_LABELS: Record<string, string> = {
  proposed_start: 'Start',
  proposed_end: 'End',
  expected_attendance: 'Expected attendance',
  layout_preference: 'Layout',
  accessibility_requirements: 'Accessibility requirements',
  equipment_requirements: 'Equipment requirements',
  status: 'Status',
  quantity_reserved: 'Quantity reserved',
}

const DATE_FIELDS = new Set(['proposed_start', 'proposed_end'])

/** An unknown action still reads as words, so a new action added in the database is not blank. */
export function auditTitle(action: string): string {
  return ACTION_TITLES[action] ?? action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'none'
  if (DATE_FIELDS.has(field) && typeof value === 'string') return formatDateTime(value)
  return String(value).replace(/_/g, ' ')
}

/**
 * The changed fields of a record as "Label: old → new" lines. Only fields present in the new
 * values are listed; identifiers (people, venues, equipment types) mean nothing to a reader, so
 * a field without a label is left out rather than shown as a UUID.
 */
export function auditChanges(entry: AuditEntry): string[] {
  const next = entry.newValues ?? {}
  const previous = entry.oldValues ?? {}
  return Object.keys(next)
    .filter((field) => field in FIELD_LABELS)
    .map((field) => {
      const label = FIELD_LABELS[field]
      return field in previous
        ? `${label}: ${show(field, previous[field])} → ${show(field, next[field])}`
        : `${label}: ${show(field, next[field])}`
    })
}

/** A venue decision's note, the one free-text value worth showing beside the status. */
export function auditNote(entry: AuditEntry): string | null {
  const note = entry.newValues?.review_note
  return typeof note === 'string' && note.trim() !== '' ? note : null
}
