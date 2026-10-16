import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { requestEventChange, CHANGE_REQUEST_MESSAGES } from './eventChangeRequestService'
import type { RequestEventChangeResult } from './eventChangeRequestService'
import type { ProposedEventChanges } from './types'

export type ChangeRequestFormValues = Required<ProposedEventChanges> & { reason: string }

const emptyChangeForm: ChangeRequestFormValues = {
  name: '',
  purpose: '',
  eventType: '',
  description: '',
  proposedStart: '',
  proposedEnd: '',
  expectedAttendance: '',
  programme: '',
  layoutPreference: '',
  accessibilityRequirements: '',
  equipmentRequirements: '',
  registrationRequired: false,
  specialArrangements: '',
  reason: '',
}

const resolver: Resolver<ChangeRequestFormValues> = (values) => {
  const errors: FieldErrors<ChangeRequestFormValues> = {}
  if (!values.reason.trim()) {
    errors.reason = { type: 'validation', message: CHANGE_REQUEST_MESSAGES.reasonRequired }
  }
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} }
}

const CHANGEABLE_TEXT_FIELDS = [
  'name',
  'purpose',
  'eventType',
  'description',
  'proposedStart',
  'proposedEnd',
  'expectedAttendance',
  'programme',
  'layoutPreference',
  'accessibilityRequirements',
  'equipmentRequirements',
  'specialArrangements',
] as const satisfies readonly (keyof ProposedEventChanges)[]


/** Collects only the fields the organiser actually filled in. A blank string means "no
 *  change to this field" — this is not a diff against original values, since the form
 *  never held original values to begin with. registrationRequired is excluded until it
 *  has a proper tri-state control (a checkbox can't represent "no change"). */
function collectChanges(values: ChangeRequestFormValues): ProposedEventChanges {
  const changes: ProposedEventChanges = {}

  for (const key of CHANGEABLE_TEXT_FIELDS) {
    const value = values[key]
    if (typeof value === 'string' && value.trim() !== '') {
      changes[key] = value
    }
  }

  return changes
}

export function useEventChangeRequestForm(eventId: string) {
  const [result, setResult] = useState<RequestEventChangeResult | null>(null)
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeRequestFormValues>({ defaultValues: emptyChangeForm, resolver })

  const onSubmit = handleSubmit(async (values) => {
    if (busy.current) return
    busy.current = true
    setResult(null)
    try {
      const changes = collectChanges(values)

      if (Object.keys(changes).length === 0) {
        setResult({ ok: false, reason: CHANGE_REQUEST_MESSAGES.noChangesProposed })
        return
      }

      const outcome = await requestEventChange(eventId, changes, values.reason)
      setResult(outcome)
      if (outcome.ok) reset(emptyChangeForm)
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
    register, errors, result, resultRef,
    onSubmit, isSubmitting, disabled: isSubmitting,
  }
}