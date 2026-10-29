import { formatDateTime } from './formatters'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * US37: reading an answered round back out.
 *
 * Keyed on database column names rather than the app's field names, because that is how
 * 0096 stores before_values and after_values — as the columns it was asked to change. The
 * record is a snapshot taken at answer time, so it has to stay readable even after the
 * app's own naming moves on.
 */

export const CLARIFICATION_COLUMN_LABELS: Record<string, string> = {
  name: 'Event name',
  purpose: 'Purpose',
  event_type: 'Event type',
  description: 'Description',
  proposed_start: 'Preferred start',
  proposed_end: 'Preferred end',
  expected_attendance: 'Expected attendance',
  programme: 'Programme',
  layout_preference: 'Room layout',
  accessibility_requirements: 'Accessibility requirements',
  facility_requirements: 'Venue facilities',
  equipment_requirements: 'Equipment',
  registration_required: 'Registration enabled',
  special_arrangements: 'Special arrangements',
}

/** An unknown column is shown as itself. A revision nobody can read is still better than
 *  a revision nobody can see — the same choice describeCodes makes for unknown codes. */
export function clarificationColumnLabel(column: string): string {
  return CLARIFICATION_COLUMN_LABELS[column] ?? column
}

const TIMESTAMP_COLUMNS = ['proposed_start', 'proposed_end']

/**
 * What a stored value should read as. Deliberately does not take the requirement
 * catalogue: a round answered months ago may name a code since retired, and showing the
 * code is honest where showing a current label would be a guess.
 */
export function formatClarificationValue(column: string, value: unknown): string {
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return 'Not set'
  if (TIMESTAMP_COLUMNS.includes(column) && typeof value === 'string') {
    return formatDateTime(value)
  }
  return String(value)
}

export interface ClarificationChange {
  column: string
  label: string
  before: string
  after: string
}

/**
 * The revisions in one round, as label/before/after rows. Driven by after_values: a column
 * recorded on the way out is a column that was submitted, whatever it held beforehand.
 */
export function clarificationChanges(
  beforeValues: Record<string, unknown>,
  afterValues: Record<string, unknown>,
): ClarificationChange[] {
  return Object.keys(afterValues)
    .sort((left, right) => clarificationColumnLabel(left).localeCompare(clarificationColumnLabel(right)))
    .map((column) => ({
      column,
      label: clarificationColumnLabel(column),
      before: formatClarificationValue(column, beforeValues[column]),
      after: formatClarificationValue(column, afterValues[column]),
    }))
}
