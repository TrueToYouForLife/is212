import { supabase } from '../../lib/supabase'
import {
  ACCESSIBILITY_OPTIONS,
  EMPTY_REQUIREMENT_CATALOGUE,
  FACILITY_OPTIONS,
} from './requirementCatalogue'
import type { FeatureOption, RequirementCatalogue } from './requirementCatalogue'

/**
 * The only Supabase access for the requirement catalogues, per the house rule.
 *
 * Layout comes from layout_types (0021) and equipment from equipment_types (0019 plus the
 * code column added in 0052); both are tables precisely so staff can add an option without
 * a code change. Accessibility and facility are the static lists shared with the venues
 * feature — 0052 seeds the same codes into accessibility_types and facility_types, so the
 * database refuses anything these lists do not offer.
 */

export const REQUIREMENT_CATALOGUE_MESSAGES = {
  unavailable: 'The requirement options could not be loaded. Please reload the page.',
} as const

export type LoadRequirementCatalogueResult =
  | { ok: true; catalogue: RequirementCatalogue }
  | { ok: false; reason: string; catalogue: RequirementCatalogue }

interface LayoutRow {
  code: string
  label: string
}

interface EquipmentRow {
  code: string
  name: string
}

/**
 * Never throws. On failure the caller still gets a usable catalogue — the accessibility
 * and facility lists, which are static — together with a reason, so the form degrades to
 * "the lists I could load" instead of rendering nothing. A requirement the organiser
 * cannot see is a requirement they cannot ask for.
 */
export async function loadRequirementCatalogue(): Promise<LoadRequirementCatalogueResult> {
  const [layoutResult, equipmentResult] = await Promise.all([
    supabase.from('layout_types').select('code, label').order('sort_order'),
    supabase.from('equipment_types').select('code, name').order('category').order('name'),
  ])

  if (layoutResult.error || equipmentResult.error) {
    console.error(
      '[events] loadRequirementCatalogue',
      layoutResult.error ?? equipmentResult.error,
    )
    return {
      ok: false,
      reason: REQUIREMENT_CATALOGUE_MESSAGES.unavailable,
      catalogue: EMPTY_REQUIREMENT_CATALOGUE,
    }
  }

  const layouts: FeatureOption[] = ((layoutResult.data ?? []) as LayoutRow[]).map((row) => ({
    code: row.code,
    label: row.label,
  }))

  // equipment_types has no label column: its name is the label, and 0052 gave it a stable
  // code so a renamed type keeps the same stored requirement.
  const equipment: FeatureOption[] = ((equipmentResult.data ?? []) as EquipmentRow[]).map(
    (row) => ({ code: row.code, label: row.name }),
  )

  return {
    ok: true,
    catalogue: {
      layouts,
      accessibility: ACCESSIBILITY_OPTIONS,
      facilities: FACILITY_OPTIONS,
      equipment,
    },
  }
}
