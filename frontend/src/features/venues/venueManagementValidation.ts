import { z } from 'zod'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from './venueFeatureCatalogue'

/**
 * PURE MODULE — US46. Checks the add-venue form before anything is sent, so Venue Staff see
 * every problem at once, next to its field. The database (0064) enforces the same rules;
 * this only makes them visible earlier.
 */

/** Opening times are the starts of AM, PM and Night (time_slots, 0018). */
export const OPENING_TIMES = [
  { value: '07:00', label: '7am (start of AM)' },
  { value: '13:00', label: '1pm (start of PM)' },
  { value: '19:00', label: '7pm (start of Night)' },
] as const

/** Closing times are the ends of AM, PM and Night. */
export const CLOSING_TIMES = [
  { value: '12:00', label: '12pm (end of AM)' },
  { value: '18:00', label: '6pm (end of PM)' },
  { value: '24:00', label: 'Midnight (end of Night)' },
] as const

export interface VenueLayoutInput {
  layout: string
  /** As typed, so a half-typed or invalid value can be shown back and explained. */
  capacity: string
}

export interface VenueFormValues {
  name: string
  location: string
  opensAt: string
  closesAt: string
  accessibility: string[]
  facilities: string[]
  layouts: VenueLayoutInput[]
}

export const EMPTY_VENUE_FORM: VenueFormValues = {
  name: '',
  location: '',
  opensAt: '',
  closesAt: '',
  accessibility: [],
  facilities: [],
  layouts: [{ layout: '', capacity: '' }],
}

/** What the database is sent once the form is valid. */
export interface NewVenue {
  name: string
  location: string
  opensAt: string
  closesAt: string
  accessibility: string[]
  facilities: string[]
  layouts: { layout: string; capacity: number }[]
}

export interface VenueFormErrors {
  name?: string
  location?: string
  hours?: string
  layouts?: string
  /** One entry per layout row, in the same order; undefined where the row is fine. */
  layoutRows?: (string | undefined)[]
}

export type VenueFormResult =
  | { ok: true; venue: NewVenue }
  | { ok: false; errors: VenueFormErrors }

export const VENUE_FORM_MESSAGES = {
  nameRequired: 'Enter the venue’s name.',
  locationRequired: 'Enter where the venue is.',
  hoursRequired: 'Choose an opening and a closing time.',
  hoursOrder: 'The venue must close after it opens.',
  layoutsRequired: 'Add at least one layout.',
  layoutRequired: 'Choose a layout.',
  layoutRepeated: 'This layout is already listed.',
  capacityInvalid: 'Capacity must be a whole number of at least 1.',
} as const

const OPENING_VALUES: readonly string[] = OPENING_TIMES.map((time) => time.value)
const CLOSING_VALUES: readonly string[] = CLOSING_TIMES.map((time) => time.value)

/**
 * AC-046.1 and AC-046.3. `layoutCodes` is the layout catalogue the form offered, so a
 * layout that has since disappeared is caught here rather than by the database.
 */
export function validateVenueForm(values: VenueFormValues, layoutCodes: readonly string[]): VenueFormResult {
  const errors: VenueFormErrors = {}

  const name = values.name.trim()
  if (!name) errors.name = VENUE_FORM_MESSAGES.nameRequired
  const location = values.location.trim()
  if (!location) errors.location = VENUE_FORM_MESSAGES.locationRequired

  if (!OPENING_VALUES.includes(values.opensAt) || !CLOSING_VALUES.includes(values.closesAt)) {
    errors.hours = VENUE_FORM_MESSAGES.hoursRequired
  } else if (values.closesAt <= values.opensAt) {
    // 'HH:MM' strings, '24:00' included, compare in time order.
    errors.hours = VENUE_FORM_MESSAGES.hoursOrder
  }

  const layouts: NewVenue['layouts'] = []
  if (values.layouts.length === 0) {
    errors.layouts = VENUE_FORM_MESSAGES.layoutsRequired
  } else {
    const seen = new Set<string>()
    const rowErrors = values.layouts.map((row) => {
      if (!layoutCodes.includes(row.layout)) return VENUE_FORM_MESSAGES.layoutRequired
      if (seen.has(row.layout)) return VENUE_FORM_MESSAGES.layoutRepeated
      seen.add(row.layout)
      const capacity = row.capacity.trim()
      // Digits only: '1.5', '-3', '1e2' and '' are all refused, '007' is 7.
      if (!/^\d+$/.test(capacity) || Number(capacity) < 1) return VENUE_FORM_MESSAGES.capacityInvalid
      layouts.push({ layout: row.layout, capacity: Number(capacity) })
      return undefined
    })
    if (rowErrors.some(Boolean)) errors.layoutRows = rowErrors
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    venue: {
      name,
      location,
      opensAt: values.opensAt,
      closesAt: values.closesAt,
      accessibility: [...new Set(values.accessibility)],
      facilities: [...new Set(values.facilities)],
      layouts,
    },
  }
}

/** A venue as get_venue_for_edit (0067) returns it. Hours are null for venues added before 0064. */
export const loadedVenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string().nullable().transform((value) => value ?? ''),
  status: z.enum(['active', 'under_maintenance', 'retired']),
  retirementNote: z.string().nullable().optional().transform((value) => value ?? null),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  accessibility: z.array(z.string()),
  facilities: z.array(z.string()),
  layouts: z.array(z.object({ layout: z.string(), capacity: z.number().int() })),
  version: z.string(),
})
export type LoadedVenue = z.infer<typeof loadedVenueSchema>

const ACCESSIBILITY_CODES: readonly string[] = ACCESSIBILITY_OPTIONS.map((option) => option.code)
const FACILITY_CODES: readonly string[] = FACILITY_OPTIONS.map((option) => option.code)

/**
 * AC-046.2: the edit form, filled in with the venue as it is. A feature the catalogue no longer
 * lists has no checkbox, so it is left out and named in `dropped`: saving would otherwise be
 * refused for a value Venue Staff cannot see. Hours a venue does not have yet stay blank, so
 * they must be chosen before saving.
 */
export function venueFormValuesFrom(venue: LoadedVenue): { values: VenueFormValues; dropped: string[] } {
  const known = (codes: string[], catalogue: readonly string[]) => codes.filter((code) => catalogue.includes(code))
  const dropped = [
    ...venue.accessibility.filter((code) => !ACCESSIBILITY_CODES.includes(code)),
    ...venue.facilities.filter((code) => !FACILITY_CODES.includes(code)),
  ]
  return {
    values: {
      name: venue.name,
      location: venue.location,
      opensAt: venue.opensAt ?? '',
      closesAt: venue.closesAt ?? '',
      accessibility: known(venue.accessibility, ACCESSIBILITY_CODES),
      facilities: known(venue.facilities, FACILITY_CODES),
      layouts: venue.layouts.length > 0
        ? venue.layouts.map((row) => ({ layout: row.layout, capacity: String(row.capacity) }))
        : [{ layout: '', capacity: '' }],
    },
    dropped,
  }
}

export const RETIREMENT_MESSAGES = {
  noteRequired: 'Say why the venue is being retired. Coordinators see this when they review their bookings.',
} as const

/** AC-046.5: retiring needs a reason, which is passed on to the affected Coordinators. */
export function validateRetirementNote(note: string): { ok: true; note: string } | { ok: false; error: string } {
  const trimmed = note.trim()
  return trimmed ? { ok: true, note: trimmed } : { ok: false, error: RETIREMENT_MESSAGES.noteRequired }
}
