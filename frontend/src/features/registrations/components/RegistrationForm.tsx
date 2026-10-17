import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import { Checkbox, Field, TextInput } from '../../../components/ui/FormControls'
import { registerForEvent } from '../registrationService'
import { acceptWaitlistOffer } from '../waitlistService'
import type { RegistrationAnswers } from '../types'
import { registrationSchema } from '../validation'

export interface RegistrationFormProps {
  eventId: string
  hasPrerequisites: boolean
  /** US16: set when this form accepts a waiting-list offer instead of registering directly. */
  waitlistEntryId?: string
}

interface FormValues {
  phone: string
  dietaryRequirements: string
  accessibilityNeeds: string
  prerequisitesConfirmed: boolean
}

/** US15 AC-015.2: the information an Attendee gives to register for one event. */
export function RegistrationForm({ eventId, hasPrerequisites, waitlistEntryId }: RegistrationFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues, unknown, RegistrationAnswers>({
      resolver: zodResolver(registrationSchema(hasPrerequisites)),
      defaultValues: { phone: '', dietaryRequirements: '', accessibilityNeeds: '', prerequisitesConfirmed: false },
    })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  // isSubmitting only updates after a render, so two clicks in a row could both get through.
  // The database would refuse the second (AC-015.5); this stops it being sent at all.
  const inFlight = useRef(false)

  async function submit(answers: RegistrationAnswers) {
    if (inFlight.current) return
    inFlight.current = true
    setSaveError(null)
    const result = waitlistEntryId
      ? await acceptWaitlistOffer(waitlistEntryId, answers, { hasPrerequisites })
      : await registerForEvent(eventId, answers, { hasPrerequisites })
    inFlight.current = false

    if (result.ok) setRegistered(true)
    else setSaveError(result.reason)
  }

  if (registered) {
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        You&apos;re registered. A confirmation email is on its way.{' '}
        <Link to="/registrations" className="font-medium underline">My registrations</Link>
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      {saveError && <ErrorAlert>{saveError}</ErrorAlert>}

      <Field id="phone" label="Phone number" error={errors.phone?.message}>
        <TextInput id="phone" type="tel" autoComplete="tel"
          aria-invalid={Boolean(errors.phone)} {...register('phone')} />
      </Field>

      <Field id="dietaryRequirements" label="Dietary requirements (optional)">
        <TextInput id="dietaryRequirements" {...register('dietaryRequirements')} />
      </Field>

      <Field id="accessibilityNeeds" label="Accessibility needs (optional)">
        <TextInput id="accessibilityNeeds" {...register('accessibilityNeeds')} />
      </Field>

      {hasPrerequisites && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox id="prerequisitesConfirmed" aria-invalid={Boolean(errors.prerequisitesConfirmed)}
              {...register('prerequisitesConfirmed')} />
            <label htmlFor="prerequisitesConfirmed" className="text-sm text-slate-700">
              I meet the prerequisites for this event
            </label>
          </div>
          {errors.prerequisitesConfirmed && (
            <p className="text-xs text-red-700">{errors.prerequisitesConfirmed.message}</p>
          )}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Registering…' : waitlistEntryId ? 'Accept place' : 'Register'}
      </Button>
    </form>
  )
}
