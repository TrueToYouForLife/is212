import { describe, expect, test } from 'vitest'
import {
  ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, describeCodes, optionsForField, sameCodes, toggleCode,
} from '../requirementCatalogue'
import { EMPTY_REQUIREMENT_CATALOGUE } from '../requirementCatalogue'

/** PURE. The option lists and helpers behind the fixed requirement controls. */

describe('AC-002.1 — the requirement controls work on catalogue codes', () => {
  test('AC-002.1.7: ticking a box adds its code and unticking removes it', () => {
    expect(toggleCode([], 'wheelchair_access')).toEqual(['wheelchair_access'])
    expect(toggleCode(['wheelchair_access'], 'wheelchair_access')).toEqual([])
    expect(toggleCode(['wheelchair_access'], 'lift_access'))
      .toEqual(['wheelchair_access', 'lift_access'])
  })

  test('AC-002.1.8: toggling returns a new list rather than editing the old one', () => {
    // The form holds this value in state, so mutating it in place would not re-render.
    const original = ['wheelchair_access']
    expect(toggleCode(original, 'lift_access')).not.toBe(original)
    expect(original).toEqual(['wheelchair_access'])
  })

  test('AC-002.1.9: two lists holding the same codes are the same requirement', () => {
    // Order is not meaningful: the 0054 trigger normalises each list on write, so two
    // forms that tick the same boxes in a different order store the same value.
    expect(sameCodes(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameCodes([], [])).toBe(true)
    expect(sameCodes(['a'], ['a', 'b'])).toBe(false)
    expect(sameCodes(['a', 'b'], ['a', 'c'])).toBe(false)
  })

  test('AC-002.1.10: stored codes are read back as labels', () => {
    expect(describeCodes(ACCESSIBILITY_OPTIONS, ['wheelchair_access', 'hearing_loop']))
      .toBe('Wheelchair access, Hearing loop')
    expect(describeCodes(FACILITY_OPTIONS, ['projector'])).toBe('Projector')
  })

  test('AC-002.1.11: an unknown code is shown as itself, never silently dropped', () => {
    // A requirement nobody can read is still better than a requirement nobody can see —
    // this is what happens if a catalogue row is removed after an event was saved.
    expect(describeCodes(ACCESSIBILITY_OPTIONS, ['retired_option']))
      .toBe('retired_option')
  })

  test('AC-002.1.12: no requirement reads as nothing, not as a stray separator', () => {
    expect(describeCodes(ACCESSIBILITY_OPTIONS, [])).toBe('')
    expect(describeCodes(ACCESSIBILITY_OPTIONS, null)).toBe('')
    expect(describeCodes(ACCESSIBILITY_OPTIONS, undefined)).toBe('')
  })

  test('AC-002.1.13: each code list field draws from its own catalogue', () => {
    const catalogue = {
      ...EMPTY_REQUIREMENT_CATALOGUE,
      equipment: [{ code: 'wireless_mic', label: 'Wireless mic' }],
    }
    expect(optionsForField(catalogue, 'accessibilityRequirements')).toBe(catalogue.accessibility)
    expect(optionsForField(catalogue, 'facilityRequirements')).toBe(catalogue.facilities)
    expect(optionsForField(catalogue, 'equipmentRequirements')).toBe(catalogue.equipment)
  })

  test('AC-002.1.14: the shared accessibility and facility codes are the venue ones', () => {
    // The point of fixing these fields is that an event requirement and a venue feature
    // are drawn from one list. If this ever fails, the two features have drifted and a
    // requirement will silently match no venue.
    expect(ACCESSIBILITY_OPTIONS.map((option) => option.code))
      .toEqual(['wheelchair_access', 'hearing_loop', 'accessible_toilet', 'lift_access'])
    expect(FACILITY_OPTIONS.map((option) => option.code))
      .toEqual(['projector', 'microphone', 'stage', 'wifi'])
  })
})
