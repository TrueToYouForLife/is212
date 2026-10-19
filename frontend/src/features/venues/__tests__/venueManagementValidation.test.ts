import { describe, expect, test } from 'vitest'
import {
  EMPTY_VENUE_FORM, RETIREMENT_MESSAGES, VENUE_FORM_MESSAGES as messages, loadedVenueSchema, validateRetirementNote,
  validateVenueForm, venueFormValuesFrom,
} from '../venueManagementValidation'
import type { VenueFormValues } from '../venueManagementValidation'

const LAYOUTS = ['theatre', 'classroom', 'boardroom']

function form(overrides: Partial<VenueFormValues> = {}): VenueFormValues {
  return {
    name: 'Grand Hall',
    location: 'Level 1',
    opensAt: '07:00',
    closesAt: '18:00',
    accessibility: ['wheelchair_access'],
    facilities: ['projector'],
    layouts: [{ layout: 'theatre', capacity: '120' }, { layout: 'classroom', capacity: '60' }],
    ...overrides,
  }
}

function errorsOf(values: VenueFormValues) {
  const result = validateVenueForm(values, LAYOUTS)
  if (result.ok) throw new Error('expected the form to be refused')
  return result.errors
}

describe('AC-046.1 — Venue Staff can add a venue with its details', () => {
  test('AC-046.1.8: a complete form becomes the venue to save, trimmed, with capacities as numbers', () => {
    const result = validateVenueForm(form({
      name: '  Grand Hall ',
      location: ' Level 1 ',
      accessibility: ['wheelchair_access', 'wheelchair_access', 'lift_access'],
      facilities: ['projector', 'projector'],
      layouts: [{ layout: 'theatre', capacity: ' 120 ' }, { layout: 'classroom', capacity: '007' }],
    }), LAYOUTS)

    expect(result).toEqual({
      ok: true,
      venue: {
        name: 'Grand Hall',
        location: 'Level 1',
        opensAt: '07:00',
        closesAt: '18:00',
        accessibility: ['wheelchair_access', 'lift_access'],
        facilities: ['projector'],
        layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 7 }],
      },
    })
  })

  test('AC-046.1.9: a venue needs a name and a location; spaces alone do not count', () => {
    expect(errorsOf(form({ name: '   ', location: '' }))).toEqual({
      name: messages.nameRequired,
      location: messages.locationRequired,
    })
  })

  test.each([
    ['no opening time', '', '18:00'],
    ['no closing time', '07:00', ''],
    ['an opening time between slots', '09:00', '18:00'],
    ['a closing time between slots', '07:00', '17:00'],
  ])('AC-046.1.10: %s is refused, because hours must be on slot boundaries', (_case, opensAt, closesAt) => {
    expect(errorsOf(form({ opensAt, closesAt })).hours).toBe(messages.hoursRequired)
  })

  test('AC-046.1.11: the venue must close after it opens; Night through midnight is allowed', () => {
    expect(errorsOf(form({ opensAt: '13:00', closesAt: '12:00' })).hours).toBe(messages.hoursOrder)
    expect(validateVenueForm(form({ opensAt: '19:00', closesAt: '24:00' }), LAYOUTS).ok).toBe(true)
    expect(validateVenueForm(form({ opensAt: '07:00', closesAt: '12:00' }), LAYOUTS).ok).toBe(true)
  })

  test('AC-046.1.12: every problem is reported at once, not one at a time', () => {
    const errors = errorsOf({ ...EMPTY_VENUE_FORM })
    expect(Object.keys(errors).sort()).toEqual(['hours', 'layoutRows', 'location', 'name'])
  })
})

describe('AC-046.3 — every supported layout has a capacity of at least 1', () => {
  test.each(['0', '-1', '1.5', '', '  ', 'abc', '1e2', '+5'])(
    'AC-046.3.5: a capacity of "%s" is refused',
    (capacity) => {
      expect(errorsOf(form({ layouts: [{ layout: 'theatre', capacity }] })).layoutRows).toEqual([messages.capacityInvalid])
    },
  )

  test('AC-046.3.6: a capacity of exactly 1 is accepted', () => {
    expect(validateVenueForm(form({ layouts: [{ layout: 'theatre', capacity: '1' }] }), LAYOUTS)).toMatchObject({
      ok: true, venue: { layouts: [{ layout: 'theatre', capacity: 1 }] },
    })
  })

  test('AC-046.3.7: a venue needs at least one layout, chosen from the catalogue and listed once', () => {
    expect(errorsOf(form({ layouts: [] })).layouts).toBe(messages.layoutsRequired)
    expect(errorsOf(form({ layouts: [{ layout: '', capacity: '10' }] })).layoutRows).toEqual([messages.layoutRequired])
    expect(errorsOf(form({ layouts: [{ layout: 'igloo', capacity: '10' }] })).layoutRows).toEqual([messages.layoutRequired])
    expect(errorsOf(form({
      layouts: [{ layout: 'theatre', capacity: '10' }, { layout: 'theatre', capacity: '20' }],
    })).layoutRows).toEqual([undefined, messages.layoutRepeated])
  })

  test('AC-046.3.8: only the rows with a problem are flagged, in the order they appear', () => {
    expect(errorsOf(form({
      layouts: [
        { layout: 'theatre', capacity: '100' },
        { layout: 'classroom', capacity: '0' },
        { layout: 'boardroom', capacity: '12' },
      ],
    }))).toEqual({ layoutRows: [undefined, messages.capacityInvalid, undefined] })
  })
})

describe('AC-046.2 — Venue Staff can edit any of a venue’s details', () => {
  const LOADED = {
    id: 'venue-1',
    name: 'Grand Hall',
    location: 'Level 1',
    status: 'active' as const,
    retirementNote: null,
    opensAt: '07:00',
    closesAt: '24:00',
    accessibility: ['wheelchair_access'],
    facilities: ['projector', 'wifi'],
    layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 60 }],
    version: 'v1',
  }

  test('AC-046.2.8: the edit form opens with the venue’s current details, capacities as typed text', () => {
    expect(venueFormValuesFrom(LOADED)).toEqual({
      values: {
        name: 'Grand Hall',
        location: 'Level 1',
        opensAt: '07:00',
        closesAt: '24:00',
        accessibility: ['wheelchair_access'],
        facilities: ['projector', 'wifi'],
        layouts: [{ layout: 'theatre', capacity: '120' }, { layout: 'classroom', capacity: '60' }],
      },
      dropped: [],
    })
  })

  test('AC-046.2.9: a venue added before operating hours existed opens with them blank, so they must be chosen', () => {
    const { values } = venueFormValuesFrom({ ...LOADED, opensAt: null, closesAt: null, layouts: [] })
    expect(values).toMatchObject({ opensAt: '', closesAt: '', layouts: [{ layout: '', capacity: '' }] })
    expect(validateVenueForm(values, LAYOUTS).ok).toBe(false)
  })

  test('AC-046.2.10: a feature the catalogue no longer offers is left out and named, rather than blocking the save', () => {
    const { values, dropped } = venueFormValuesFrom({
      ...LOADED, accessibility: ['wheelchair_access', 'ramp'], facilities: ['projector', 'piano'],
    })
    expect(values.accessibility).toEqual(['wheelchair_access'])
    expect(values.facilities).toEqual(['projector'])
    expect(dropped).toEqual(['ramp', 'piano'])
  })

  test('AC-046.2.11: a venue with no location recorded opens with it blank', () => {
    const parsed = loadedVenueSchema.parse({ ...LOADED, location: null })
    expect(parsed.location).toBe('')
  })
})

describe('AC-046.5 — Venue Staff can retire a venue', () => {
  test('AC-046.5.11: retiring needs a reason; spaces alone do not count', () => {
    expect(validateRetirementNote('   ')).toEqual({ ok: false, error: RETIREMENT_MESSAGES.noteRequired })
    expect(validateRetirementNote('')).toEqual({ ok: false, error: RETIREMENT_MESSAGES.noteRequired })
  })

  test('AC-046.5.12: the reason is sent trimmed', () => {
    expect(validateRetirementNote('  Building closes  ')).toEqual({ ok: true, note: 'Building closes' })
  })

  test('AC-046.5.13: a venue opens with its retirement reason, or none if it was never given one', () => {
    const base = {
      id: 'v1', name: 'Hall', location: 'L1', opensAt: '07:00', closesAt: '12:00',
      accessibility: [], facilities: [], layouts: [], version: 'v1',
    }
    expect(loadedVenueSchema.parse({ ...base, status: 'retired', retirementNote: 'Closing' }).retirementNote).toBe('Closing')
    expect(loadedVenueSchema.parse({ ...base, status: 'active' }).retirementNote).toBeNull()
  })
})
