import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { submitEventRequest, SERVICE_MESSAGES } from './eventService'
import { saveEventDraft, DRAFT_MESSAGES } from './eventDraftService'
import { validateEventRequest } from './validation'
import type { RequirementCodeOptions } from './validation'
import { draftFormValues } from './draftFormValues'
import { loadRequirementCatalogue } from './requirementCatalogueService'
import { EMPTY_REQUIREMENT_CATALOGUE } from './requirementCatalogue'
import type { RequirementCatalogue } from './requirementCatalogue'
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
  accessibilityRequirements: [],
  facilityRequirements: [],
  equipmentRequirements: [],
  registrationRequired: false,
  specialArrangements: '',
}

export function useEventRequestForm(initialDraft?: LoadedEventDraft) {
  const [result, setResult] = useState<SubmitEventRequestResult | null>(null)
  const [draftResult, setDraftResult] = useState<SaveEventDraftResult | null>(null)
  const [draftId, setDraftId] = useState<string | undefined>(initialDraft?.id)
  const [isSaving, setIsSaving] = useState(false)
  const [catalogue, setCatalogue] = useState<RequirementCatalogue>(EMPTY_REQUIREMENT_CATALOGUE)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const busy = useRef(false)
  const resultRef = useRef<HTMLDivElement>(null)

  /**
   * The validator needs the loaded layout and equipment codes, but the resolver is
   * created once and the catalogue arrives later. A ref keeps the resolver reading the
   * current codes without rebuilding the form, which would discard what has been typed.
   */
  const codesRef = useRef<RequirementCodeOptions>({})

  // React Hook Form is wired to our own pure validator instead of zodResolver, so the
  // rules the form enforces are byte-for-byte the rules the unit tests assert. One
  // definition, two consumers.
  const resolver: Resolver<EventRequestFormValues> = useCallback((values) => {
    const outcome = validateEventRequest(values, { codes: codesRef.current })
    if (outcome.ok) return { values, errors: {} }

    const errors = Object.fromEntries(
      outcome.issues.map((issue) => [issue.field, { type: 'validation', message: issue.message }]),
    ) as FieldErrors<EventRequestFormValues>

    return { values: {}, errors }
  }, [])

  const {
    register,
    control,
    getValues,
    clearErrors,
    setError,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventRequestFormValues>({
    defaultValues: initialDraft ? draftFormValues(initialDraft) : emptyForm,
    resolver,
  })

  useEffect(() => {
    let cancelled = false
    loadRequirementCatalogue().then((outcome) => {
      if (cancelled) return
      setCatalogue(outcome.catalogue)
      setCatalogueError(outcome.ok ? null : outcome.reason)
      codesRef.current = {
        layouts: outcome.catalogue.layouts.map((option) => option.code),
        equipment: outcome.catalogue.equipment.map((option) => option.code),
      }
    })
    return () => { cancelled = true }
  }, [])

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
      const outcome = await saveEventDraft(getValues(), draftId, { codes: codesRef.current })
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
    register, control, errors, result, draftResult, draftId, resultRef,
    catalogue, catalogueError,
    onSubmit, onSaveDraft, isSaving, isSubmitting, disabled: isSaving || isSubmitting,
    onChange: () => { setResult(null); setDraftResult(null) },
  }
}
