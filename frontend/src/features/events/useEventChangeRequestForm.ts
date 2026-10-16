import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { requestEventChange, CHANGE_REQUEST_MESSAGES } from './eventChangeRequestService'
import type { RequestEventChangeResult } from './eventChangeRequestService'
import { loadRequirementCatalogue } from './requirementCatalogueService'
import { EMPTY_REQUIREMENT_CATALOGUE, sameCodes } from './requirementCatalogue'
import type { RequirementCatalogue } from './requirementCatalogue'
import type { EventRequestDetail, ProposedEventChanges } from './types'

export type ChangeRequestFormValues = Required<ProposedEventChanges> & { reason: string }

/**
 * The event's requirements as they stand now. The fixed fields are prefilled from these
 * and compared against them, so the form only ever proposes a field the organiser
 * actually moved.
 */
export type ChangeRequestCurrentValues = Pick<
  EventRequestDetail,
  'layoutPreference' | 'accessibilityRequirements' | 'facilityRequirements' | 'equipmentRequirements'
>

export const NO_CURRENT_REQUIREMENTS: ChangeRequestCurrentValues = {
  layoutPreference: null,
  accessibilityRequirements: [],
  facilityRequirements: [],
  equipmentRequirements: [],
}

/**
 * Free text starts blank, because for those fields a blank still means "keep current".
 * The fixed fields start at the event's current value, because for them blank cannot
 * mean that: an empty layout dropdown is a real choice ("no preference") and an empty
 * checkbox group is a real proposal ("drop every requirement"). There is no third state
 * a select or a checkbox can hold, so "no change" has to be expressed as "unchanged
 * from what is shown" and detected by comparison.
 */
function initialValues(current: ChangeRequestCurrentValues): ChangeRequestFormValues {
  return {
    name: '',
    purpose: '',
    eventType: '',
    description: '',
    proposedStart: '',
    proposedEnd: '',
    expectedAttendance: '',
    programme: '',
    layoutPreference: current.layoutPreference ?? '',
    accessibilityRequirements: [...current.accessibilityRequirements],
    facilityRequirements: [...current.facilityRequirements],
    equipmentRequirements: [...current.equipmentRequirements],
    registrationRequired: false,
    specialArrangements: '',
    reason: '',
  }
}

const resolver: Resolver<ChangeRequestFormValues> = (values) => {
  const errors: FieldErrors<ChangeRequestFormValues> = {}
  if (!values.reason.trim()) {
    errors.reason = { type: 'validation', message: CHANGE_REQUEST_MESSAGES.reasonRequired }
  }
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} }
}

/** Free text: a non-blank entry is the proposal, a blank one means "keep current". */
const CHANGEABLE_TEXT_FIELDS = [
  'name',
  'purpose',
  'eventType',
  'description',
  'proposedStart',
  'proposedEnd',
  'expectedAttendance',
  'programme',
  'specialArrangements',
] as const satisfies readonly (keyof ProposedEventChanges)[]

/** Fixed choices: compared against the event's current value instead. */
const CODE_LIST_FIELDS = [
  'accessibilityRequirements',
  'facilityRequirements',
  'equipmentRequirements',
] as const satisfies readonly (keyof ProposedEventChanges)[]

/**
 * Collects the fields the organiser actually changed.
 *
 * Text fields keep the original rule: anything non-blank is a proposal. The fixed fields
 * are diffed against the current event, so reopening the form and submitting without
 * touching a dropdown proposes nothing — which is what the coordinator needs, because
 * every proposed field costs them a decision and a note.
 *
 * registrationRequired is still excluded: a plain checkbox cannot say "no change", and
 * unlike the requirement groups it is not prefilled from the event, so a diff would be
 * meaningless. It needs a tri-state control, which is its own piece of work.
 */
export function collectChanges(
  values: ChangeRequestFormValues,
  current: ChangeRequestCurrentValues,
): ProposedEventChanges {
  const changes: ProposedEventChanges = {}

  for (const key of CHANGEABLE_TEXT_FIELDS) {
    const value = values[key]
    if (typeof value === 'string' && value.trim() !== '') {
      changes[key] = value
    }
  }

  // '' in the dropdown is "no preference", which differs from a stored layout and is a
  // legitimate change to propose; it only counts when the event actually has one today.
  const chosenLayout = values.layoutPreference.trim()
  const currentLayout = current.layoutPreference ?? ''
  if (chosenLayout !== currentLayout) {
    changes.layoutPreference = chosenLayout
  }

  for (const key of CODE_LIST_FIELDS) {
    if (!sameCodes(values[key], current[key])) {
      changes[key] = [...values[key]]
    }
  }

  return changes
}

export function useEventChangeRequestForm(
  eventId: string,
  current: ChangeRequestCurrentValues = NO_CURRENT_REQUIREMENTS,
) {
  const [result, setResult] = useState<RequestEventChangeResult | null>(null)
  const [catalogue, setCatalogue] = useState<RequirementCatalogue>(EMPTY_REQUIREMENT_CATALOGUE)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // Captured per render from props; the defaults are only read when the form is created
  // or reset, so a later reload of the event does not silently rewrite what is on screen
  // while the organiser is typing.
  const defaults = useCallback(() => initialValues(current), [current])

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeRequestFormValues>({ defaultValues: defaults(), resolver })

  useEffect(() => {
    let cancelled = false
    loadRequirementCatalogue().then((outcome) => {
      if (cancelled) return
      setCatalogue(outcome.catalogue)
      setCatalogueError(outcome.ok ? null : outcome.reason)
    })
    return () => { cancelled = true }
  }, [])

  const onSubmit = handleSubmit(async (values) => {
    if (busy.current) return
    busy.current = true
    setResult(null)
    try {
      const changes = collectChanges(values, current)

      if (Object.keys(changes).length === 0) {
        setResult({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
        return
      }

      const outcome = await requestEventChange(eventId, changes, values.reason)
      setResult(outcome)
      // Reset back to the event as it stands, not to blank: the proposal is pending, so
      // the current values on screen are still the current values.
      if (outcome.ok) reset(defaults())
    } catch {
      setResult({ ok: false, reason: CHANGE_REQUEST_MESSAGES.unexpected })
    } finally {
      busy.current = false
    }
  })

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [result])

  return {
    register, control, errors, result, resultRef, catalogue, catalogueError,
    onSubmit, isSubmitting, disabled: isSubmitting,
  }
}
