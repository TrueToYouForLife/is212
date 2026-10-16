import type { ProposedEventChanges } from './types'

// AC11 maps venue requirements to the structured layout/accessibility fields.
// Classify the stored proposal, not today's event: approval changes the event,
// but must not retrospectively change what this request was classified as.
const SIGNIFICANT_FIELDS = [
  'proposedStart', 'proposedEnd', 'expectedAttendance',
  'layoutPreference', 'accessibilityRequirements', 'equipmentRequirements',
] as const satisfies readonly (keyof ProposedEventChanges)[]

export function classifyChangeRequest(proposedChanges: ProposedEventChanges) {
  const fields = SIGNIFICANT_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(proposedChanges, field) && proposedChanges[field] !== undefined)
  return { kind: fields.length > 0 ? 'significant' as const : 'ordinary' as const, fields }
}
