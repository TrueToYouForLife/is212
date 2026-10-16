import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { submitEventRequest, SERVICE_MESSAGES } from './eventService'
import { saveEventDraft, DRAFT_MESSAGES } from './eventDraftService'
import { validateEventRequest } from './validation'
import { draftFormValues } from './draftFormValues'
import type { EventRequestFormValues, SubmitEventRequestResult, SaveEventDraftResult, LoadedEventDraft } from './types'

const emptyForm: EventRequestFormValues = {
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
}

/**
 * React Hook Form is wired to our own pure validator instead of zodResolver, so the rules
 * the form enforces are byte-for-byte the rules the unit tests assert. One definition,
 * two consumers.
 */
const resolver: Resolver<EventRequestFormValues> = (values) => {
  const result = validateEventRequest(values)
  if (result.ok) return { values, errors: {} }

  const errors = Object.fromEntries(
    result.issues.map((issue) => [issue.field, { type: 'validation', message: issue.message }]),
  ) as FieldErrors<EventRequestFormValues>

  return { values: {}, errors }
}

export function useEventRequestForm(initialDraft?: LoadedEventDraft) {
  const [result, setResult] = useState<SubmitEventRequestResult | null>(null)
  const [draftResult, setDraftResult] = useState<SaveEventDraftResult | null>(null)
  const [draftId, setDraftId] = useState<string | undefined>(initialDraft?.id)
  const [isSaving, setIsSaving] = useState(false)
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const {
    register,
    getValues,
    clearErrors,
    setError,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventRequestFormValues>({ defaultValues: initialDraft ? draftFormValues(initialDraft) : emptyForm, resolver })

  // AC-005.2 keeps this handler from ever running with invalid values; the service
  // revalidates anyway, because it is callable from places that are not this form.
  const onSubmit = handleSubmit(async (values) => {
    if (busy.current) return
    busy.current = true
    setDraftResult(null)
    setResult(null)
    try {
      const outcome = await submitEventRequest(values, draftId)
      setResult(outcome)
      if (outcome.ok) {
        setDraftId(undefined)
        reset(emptyForm)
      }
    } catch {
      setResult({ ok: false, reason: SERVICE_MESSAGES.network, issues: [] })
    } finally {
      busy.current = false
    }
  })

  const onSaveDraft = async () => {
    if (busy.current) return
    busy.current = true
    setIsSaving(true)
    setResult(null)
    setDraftResult(null)
    clearErrors()
    try {
      // Deliberately bypass handleSubmit: unfinished drafts use their own validator.
      const outcome = await saveEventDraft(getValues(), draftId)
      setDraftResult(outcome)
      if (outcome.ok) setDraftId(outcome.draft.id)
      else for (const issue of outcome.issues) {
        setError(issue.field === 'form' ? 'root' : issue.field, {
          type: 'validation', message: issue.message,
        })
      }
    } catch {
      setDraftResult({ ok: false, reason: DRAFT_MESSAGES.saveFailed, issues: [] })
    } finally {
      busy.current = false
      setIsSaving(false)
    }
  }

  // The banner sits above a long form, so the organiser presses Submit at the bottom and
  // would otherwise see nothing happen. React Hook Form already focuses the first invalid
  // field; this covers the outcome of a submission that actually reached the server.
  useEffect(() => {
    if (result || draftResult) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [result, draftResult])

  return {
    register, errors, result, draftResult, draftId, resultRef,
    onSubmit, onSaveDraft, isSaving, isSubmitting, disabled: isSaving || isSubmitting,
    onChange: () => { setResult(null); setDraftResult(null) },
  }
}
