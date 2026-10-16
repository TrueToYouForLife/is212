import { describe, expect, test } from 'vitest'
import { collectChanges } from '../useEventChangeRequestForm'
import type { ChangeRequestCurrentValues, ChangeRequestFormValues } from '../useEventChangeRequestForm'

/**
 * PURE. What a change request actually proposes.
 *
 * The two kinds of field behave differently on purpose. A blank text box means "keep
 * current", because for text that is unambiguous. A fixed control cannot say the same
 * thing: an empty layout dropdown is a real choice ("no preference") and an empty
 * checkbox group is a real proposal ("drop every requirement"), so there is no third
 * state left for "no change". The only coherent rule is to prefill the fixed controls
 * from the event and propose a field only when it differs from what was shown.
 */

const current: ChangeRequestCurrentValues = {
  layoutPreference: 'theatre',
  accessibilityRequirements: ['wheelchair_access'],
  facilityRequirements: ['projector'],
  equipmentRequirements: ['wireless_mic'],
}

/** The form as the organiser first sees it: text blank, fixed controls prefilled. */
const asShown: ChangeRequestFormValues = {
  name: '', purpose: '', eventType: '', description: '',
  proposedStart: '', proposedEnd: '', expectedAttendance: '', programme: '',
  layoutPreference: 'theatre',
  accessibilityRequirements: ['wheelchair_access'],
  facilityRequirements: ['projector'],
  equipmentRequirements: ['wireless_mic'],
  registrationRequired: false,
  specialArrangements: '',
  reason: 'Because',
}

describe('AC-006.4 — only the fields the organiser changed are proposed', () => {
  test('AC-006.4.9: submitting the form untouched proposes nothing', () => {
    // Every proposed field costs the coordinator a decision and a note, so a form that
    // was only opened and submitted must not queue four of them.
    expect(collectChanges(asShown, current)).toEqual({})
  })

  test('AC-006.4.10: changing the layout dropdown proposes only the layout', () => {
    expect(collectChanges({ ...asShown, layoutPreference: 'banquet' }, current))
      .toEqual({ layoutPreference: 'banquet' })
  })

  test('AC-006.4.11: clearing the layout proposes "no preference", not nothing', () => {
    // The event asks for theatre today; choosing the blank option is a real change.
    expect(collectChanges({ ...asShown, layoutPreference: '' }, current))
      .toEqual({ layoutPreference: '' })
  })

  test('AC-006.4.12: unticking every accessibility box proposes an empty list', () => {
    // This is the case a blank-means-no-change rule cannot express at all.
    expect(collectChanges({ ...asShown, accessibilityRequirements: [] }, current))
      .toEqual({ accessibilityRequirements: [] })
  })

  test('AC-006.4.13: reordering the same ticks is not a change', () => {
    expect(collectChanges({
      ...asShown,
      accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'],
    }, current)).toEqual({})
  })

  test('AC-006.4.14: adding a requirement proposes the whole new list, not the addition', () => {
    // The review RPC applies an approved field by assignment, so a proposal has to be
    // the complete set the organiser wants to end up with. A delta would need merge
    // rules, and a merge rule applied to a partly approved review would be guesswork.
    expect(collectChanges({
      ...asShown,
      accessibilityRequirements: ['wheelchair_access', 'lift_access'],
    }, current)).toEqual({ accessibilityRequirements: ['wheelchair_access', 'lift_access'] })
  })

  test('AC-006.4.15: text fields still use blank to mean "keep current"', () => {
    expect(collectChanges({ ...asShown, name: 'New name' }, current))
      .toEqual({ name: 'New name' })
    expect(collectChanges({ ...asShown, name: '   ' }, current)).toEqual({})
  })

  test('AC-006.4.16: a changed text field and a changed requirement travel together', () => {
    expect(collectChanges({
      ...asShown,
      expectedAttendance: '200',
      facilityRequirements: ['projector', 'stage'],
    }, current)).toEqual({
      expectedAttendance: '200',
      facilityRequirements: ['projector', 'stage'],
    })
  })

  test('AC-006.4.17: an event with no requirements yet proposes only what was ticked', () => {
    const empty: ChangeRequestCurrentValues = {
      layoutPreference: null,
      accessibilityRequirements: [],
      facilityRequirements: [],
      equipmentRequirements: [],
    }
    const blankForm: ChangeRequestFormValues = {
      ...asShown,
      layoutPreference: '',
      accessibilityRequirements: [],
      facilityRequirements: [],
      equipmentRequirements: [],
    }
    expect(collectChanges(blankForm, empty)).toEqual({})
    expect(collectChanges({ ...blankForm, facilityRequirements: ['wifi'] }, empty))
      .toEqual({ facilityRequirements: ['wifi'] })
  })

  test('AC-006.4.18: the proposal does not share arrays with the form state', () => {
    // The form keeps editing its own value after submitting; a shared array would let a
    // later tick change what was already sent for review.
    const values = { ...asShown, facilityRequirements: ['projector', 'stage'] }
    const changes = collectChanges(values, current)
    expect(changes.facilityRequirements).not.toBe(values.facilityRequirements)
    expect(changes.facilityRequirements).toEqual(['projector', 'stage'])
  })

  test('AC-006.4.19: registrationRequired is never proposed', () => {
    // A plain checkbox cannot say "no change" and it is not prefilled from the event, so
    // a diff would be meaningless. It needs a tri-state control, which is separate work.
    expect(collectChanges({ ...asShown, registrationRequired: true }, current)).toEqual({})
  })
})
