import { supabase } from '../../lib/supabase'
import type { FeatureOption } from './venueFeatureCatalogue'
import type { NewVenue } from './venueManagementValidation'

export const VENUE_MANAGEMENT_MESSAGES = {
  notSignedIn: 'You must be signed in to manage venues.',
  notVenueStaff: 'Only Venue Staff can add venues.',
  duplicateName: 'Another venue already has this name. Choose a different name.',
  invalidHours: 'Opening and closing times must be on slot boundaries, with closing after opening.',
  failed: 'The venue could not be saved. Please try again.',
  layoutsUnavailable: 'The layout options could not be loaded. Please reload the page.',
} as const

export type LayoutOptionsResult =
  | { ok: true; layouts: FeatureOption[] }
  | { ok: false; reason: string }

export type AddVenueResult =
  | { ok: true; venueId: string }
  | { ok: false; reason: string }

interface LayoutRow {
  code: string
  label: string
}

/** The layouts a venue can offer: the same catalogue events request from (0021). */
export async function loadLayoutOptions(): Promise<LayoutOptionsResult> {
  const { data, error } = await supabase.from('layout_types').select('code, label').order('sort_order')
  if (error) {
    console.error('[venues] loadLayoutOptions', error)
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.layoutsUnavailable }
  }
  const layouts = ((data ?? []) as LayoutRow[]).map((row) => ({ code: row.code, label: row.label }))
  // An empty catalogue would leave a form nobody can complete.
  if (layouts.length === 0) return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.layoutsUnavailable }
  return { ok: true, layouts }
}

/**
 * AC-046.1: one call, so a venue and its layouts are saved together or not at all (0064's
 * add_venue). The database repeats every check the form makes, and RLS decides who may add.
 */
export async function addVenue(venue: NewVenue): Promise<AddVenueResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notSignedIn }
  }

  const { data, error } = await supabase.rpc('add_venue', {
    p_name: venue.name,
    p_location: venue.location,
    p_opens_at: venue.opensAt,
    p_closes_at: venue.closesAt,
    p_accessibility: venue.accessibility,
    p_facilities: venue.facilities,
    p_layouts: venue.layouts,
  })

  if (error) {
    switch (error.code) {
      case '42501':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notVenueStaff }
      case '23505':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.duplicateName }
      case '23514':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.invalidHours }
      case '22023':
        // add_venue's own messages ("Every layout needs a capacity of at least 1") are
        // written for Venue Staff, so they are shown as they are.
        return { ok: false, reason: error.message }
      default:
        console.error('[venues] addVenue', error)
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.failed }
    }
  }
  return { ok: true, venueId: data as string }
}
