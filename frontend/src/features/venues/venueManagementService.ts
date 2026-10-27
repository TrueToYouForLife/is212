import { supabase } from '../../lib/supabase'
import type { FeatureOption } from './venueFeatureCatalogue'
import { loadedVenueSchema } from './venueManagementValidation'
import type { LoadedVenue, NewVenue } from './venueManagementValidation'
import type { VenueStatus } from './types'

export const VENUE_MANAGEMENT_MESSAGES = {
  notSignedIn: 'You must be signed in to manage venues.',
  notVenueStaff: 'Only Venue Staff can add venues.',
  duplicateName: 'Another venue already has this name. Choose a different name.',
  invalidHours: 'Opening and closing times must be on slot boundaries, with closing after opening.',
  failed: 'The venue could not be saved. Please try again.',
  layoutsUnavailable: 'The layout options could not be loaded. Please reload the page.',
  notVenueStaffEdit: 'Only Venue Staff can edit venues.',
  venueNotFound: 'This venue could not be found. It may have been removed.',
  venueUnavailable: 'The venue could not be loaded. Please try again.',
  venuesUnavailable: 'The venues could not be loaded. Please try again.',
  stale: 'Someone else changed this venue while you were editing. Reload it to see their changes, then make yours again.',
  notVenueStaffRetire: 'Only Venue Staff can retire venues.',
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

export interface ManagedVenue {
  id: string
  name: string
  location: string
  status: VenueStatus
  capacity: number
}

export type ManagedVenuesResult =
  | { ok: true; venues: ManagedVenue[] }
  | { ok: false; reason: string }

export type LoadVenueResult =
  | { ok: true; venue: LoadedVenue }
  | { ok: false; reason: string }

export type UpdateVenueResult =
  | { ok: true; flagged: number }
  | { ok: false; reason: string; stale?: true }

/** US46 slice 2: every venue Venue Staff can edit, by name. Retired ones are listed too. */
export async function listManagedVenues(): Promise<ManagedVenuesResult> {
  const { data, error } = await supabase.from('venues').select('id, name, location, status, capacity').order('name')
  if (error) {
    console.error('[venues] listManagedVenues', error)
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venuesUnavailable }
  }
  const venues = ((data ?? []) as (Omit<ManagedVenue, 'location'> & { location: string | null })[])
    .map((row) => ({ ...row, location: row.location ?? '' }))
  return { ok: true, venues }
}

/** AC-046.2: a venue as the edit form shows it, with the version saving will check. */
export async function loadVenueForEdit(venueId: string): Promise<LoadVenueResult> {
  const { data, error } = await supabase.rpc('get_venue_for_edit', { p_venue_id: venueId })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notVenueStaffEdit }
    if (error.code === 'P0002') return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venueNotFound }
    console.error('[venues] loadVenueForEdit', error)
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venueUnavailable }
  }
  const parsed = loadedVenueSchema.safeParse(data)
  if (!parsed.success) {
    console.error('[venues] loadVenueForEdit: unexpected shape', parsed.error)
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venueUnavailable }
  }
  return { ok: true, venue: parsed.data }
}

/**
 * AC-046.2, AC-046.4: every detail is saved together or not at all (0067's update_venue), and
 * only if nobody has changed the venue since it was opened. The database flags any booking the
 * edit may have made unsuitable and returns how many; no booking's status changes.
 */
export async function updateVenue(venueId: string, version: string, venue: NewVenue): Promise<UpdateVenueResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notSignedIn }
  }

  const { data, error } = await supabase.rpc('update_venue', {
    p_venue_id: venueId,
    p_version: version,
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
      case '40001':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.stale, stale: true }
      case '42501':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notVenueStaffEdit }
      case 'P0002':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venueNotFound }
      case '23505':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.duplicateName }
      case '23514':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.invalidHours }
      case '22023':
        return { ok: false, reason: error.message }
      default:
        console.error('[venues] updateVenue', error)
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.failed }
    }
  }
  return { ok: true, flagged: typeof data === 'number' ? data : 0 }
}

/**
 * AC-046.5: retires the venue with a reason (0070's retire_venue), only if nobody has changed it
 * since it was opened. Its live bookings are flagged for their Coordinators, never cancelled;
 * returns how many were flagged.
 */
export async function retireVenue(venueId: string, version: string, note: string): Promise<UpdateVenueResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !sessionData?.user) {
    return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notSignedIn }
  }

  const { data, error } = await supabase.rpc('retire_venue', { p_venue_id: venueId, p_version: version, p_note: note })
  if (error) {
    switch (error.code) {
      case '40001':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.stale, stale: true }
      case '42501':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.notVenueStaffRetire }
      case 'P0002':
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.venueNotFound }
      case '22023':
        return { ok: false, reason: error.message }
      default:
        console.error('[venues] retireVenue', error)
        return { ok: false, reason: VENUE_MANAGEMENT_MESSAGES.failed }
    }
  }
  return { ok: true, flagged: typeof data === 'number' ? data : 0 }
}
