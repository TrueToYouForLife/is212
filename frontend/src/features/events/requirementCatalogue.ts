import {
  ACCESSIBILITY_OPTIONS,
  FACILITY_OPTIONS,
  featureLabel,
} from '../venues/venueFeatureCatalogue'
import type { FeatureOption } from '../venues/venueFeatureCatalogue'

/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * The option lists behind the event request form's requirement controls, and the helpers
 * that turn a stored code back into words.
 *
 * Accessibility and facility codes are imported from the venues feature rather than
 * redeclared here. That import is deliberate: the whole point of making these fields
 * fixed is that the event's requirements and the venue's features are drawn from one
 * list, so a requirement can be matched to a venue. A second copy of the codes in this
 * folder would be free to drift, and a drifted code silently matches nothing — exactly
 * the bug this change exists to remove. 0052 seeds the same codes into
 * accessibility_types and facility_types, so the database enforces what this file offers.
 *
 * Layout and equipment are not listed here because they are genuinely dynamic: layouts
 * come from layout_types (0021) and equipment from equipment_types (0019), both of which
 * staff can add to without a code change. requirementCatalogueService loads those.
 */

export type { FeatureOption }
export { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, featureLabel }

/** The four requirement fields, and whether each one holds one code or a list of them. */
export const SINGLE_CODE_REQUIREMENT_FIELDS = ['layoutPreference'] as const
export const CODE_LIST_REQUIREMENT_FIELDS = [
  'accessibilityRequirements',
  'facilityRequirements',
  'equipmentRequirements',
] as const

export type CodeListRequirementField = (typeof CODE_LIST_REQUIREMENT_FIELDS)[number]

/**
 * What the forms need to render their dropdown and checkboxes. Layout and equipment are
 * loaded; accessibility and facility are the static lists above.
 */
export interface RequirementCatalogue {
  layouts: readonly FeatureOption[]
  accessibility: readonly FeatureOption[]
  facilities: readonly FeatureOption[]
  equipment: readonly FeatureOption[]
}

/** Used until the loaded catalogues arrive, so a form never renders an undefined list. */
export const EMPTY_REQUIREMENT_CATALOGUE: RequirementCatalogue = {
  layouts: [],
  accessibility: ACCESSIBILITY_OPTIONS,
  facilities: FACILITY_OPTIONS,
  equipment: [],
}

/** Adding or removing one code, for a checkbox group. Order is not meaningful: the
 *  database normalises each list on write, so two forms that tick the same boxes in a
 *  different order store the same value. */
export function toggleCode(codes: readonly string[], code: string): string[] {
  return codes.includes(code)
    ? codes.filter((item) => item !== code)
    : [...codes, code]
}

/** Two code lists hold the same requirement when they hold the same codes. */
export function sameCodes(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const sorted = [...right].sort()
  return [...left].sort().every((code, index) => code === sorted[index])
}

/** Human-readable, for display and for a one-line summary in a review screen. An unknown
 *  code is shown as itself rather than hidden: a requirement nobody can read is still
 *  better than a requirement nobody can see. */
export function describeCodes(
  options: readonly FeatureOption[],
  codes: readonly string[] | null | undefined,
): string {
  if (!codes || codes.length === 0) return ''
  return codes.map((code) => featureLabel(options, code)).join(', ')
}

/** The options a field draws from, so one lookup serves display and validation. */
export function optionsForField(
  catalogue: RequirementCatalogue,
  field: CodeListRequirementField,
): readonly FeatureOption[] {
  switch (field) {
    case 'accessibilityRequirements':
      return catalogue.accessibility
    case 'facilityRequirements':
      return catalogue.facilities
    case 'equipmentRequirements':
      return catalogue.equipment
  }
}
