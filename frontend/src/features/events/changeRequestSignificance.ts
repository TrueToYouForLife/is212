import type { ProposedEventChanges } from './types'

// AC11 maps venue requirements to the structured layout/accessibility fields.
// Classify the stored proposal, not today's event: approval changes the event,
// but must not retrospectively change what this request was classified as.
//
// facilityRequirements joins the list because it is a venue requirement in exactly the
// way layout and accessibility are: changing it can make the booked venue unsuitable.
// It must stay in step with the significant-field list in 0055's revalidation trigger —
// that trigger is the enforcement, this is only the label.
const SIGNIFICANT_FIELDS = [
  'proposedStart', 'proposedEnd', 'expectedAttendance',
  'layoutPreference', 'accessibilityRequirements', 'facilityRequirements',
  'equipmentRequirements',
] as const satisfies readonly (keyof ProposedEventChanges)[]

export function classifyChangeRequest(proposedChanges: ProposedEventChanges) {
  const fields = SIGNIFICANT_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(proposedChanges, field) && proposedChanges[field] !== undefined)
  return { kind: fields.length > 0 ? 'significant' as const : 'ordinary' as const, fields }
}

