import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { useEventChangeRequestForm } from '../useEventChangeRequestForm'
import type { ChangeRequestFormValues } from '../useEventChangeRequestForm'
import type { RequestEventChangeResult } from '../eventChangeRequestService'
import type { UseFormRegister } from 'react-hook-form'

function ChangeRequestResultBanner({ result }: { result: RequestEventChangeResult | null }) {
  if (!result) return null
  if (result.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
        Your change request has been submitted for review.
      </p>
    )
  }
  return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.reason}</p>
}

function ChangeOptionalFields({ register }: { register: UseFormRegister<ChangeRequestFormValues> }) {
  return (
    <div className="space-y-4">
      <Field id="programme" label="Programme">
        <TextArea id="programme" placeholder="Leave blank to keep current" {...register('programme')} />
      </Field>
      <Field id="layoutPreference" label="Room layout">
        <TextInput id="layoutPreference" placeholder="Leave blank to keep current" {...register('layoutPreference')} />
      </Field>
      <Field id="accessibilityRequirements" label="Accessibility requirements">
        <TextArea id="accessibilityRequirements" placeholder="Leave blank to keep current" {...register('accessibilityRequirements')} />
      </Field>
      <Field id="equipmentRequirements" label="Equipment requirements">
        <TextArea id="equipmentRequirements" placeholder="Leave blank to keep current" {...register('equipmentRequirements')} />
      </Field>
      <Field id="specialArrangements" label="Special arrangements">
        <TextArea id="specialArrangements" placeholder="Leave blank to keep current" {...register('specialArrangements')} />
      </Field>
    </div>
  )
}

export function EventChangeRequestForm({ eventId }: { eventId: string }) {
  const { register, errors, result, resultRef, onSubmit, isSubmitting, disabled } =
    useEventChangeRequestForm(eventId)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={resultRef}>
        <ChangeRequestResultBanner result={result} />
      </div>

      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          About the event
        </legend>

        <Field id="name" label="Event name">
          <TextInput id="name" placeholder="Leave blank to keep current" {...register('name')} />
        </Field>
        <Field id="purpose" label="Purpose of the event" error={errors.purpose?.message}>
          <TextArea id="purpose" placeholder="Leave blank to keep current" {...register('purpose')} />
        </Field>
        <Field id="eventType" label="Type of event">
          <TextInput id="eventType" placeholder="Leave blank to keep current" {...register('eventType')} />
        </Field>
        <Field id="description" label="Description">
          <TextArea id="description" placeholder="Leave blank to keep current" {...register('description')} />
        </Field>
      </fieldset>

      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          When and how many
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="proposedStart" label="Preferred start" error={errors.proposedStart?.message}>
            <TextInput id="proposedStart" type="datetime-local" step="any" {...register('proposedStart')} />
          </Field>
          <Field id="proposedEnd" label="Preferred end" error={errors.proposedEnd?.message}>
            <TextInput id="proposedEnd" type="datetime-local" step="any" {...register('proposedEnd')} />
          </Field>
        </div>

        <Field id="expectedAttendance" label="Expected number of attendees" error={errors.expectedAttendance?.message}>
          <TextInput id="expectedAttendance" type="number" min={1} placeholder="Leave blank to keep current" {...register('expectedAttendance')} />
        </Field>
      </fieldset>

      <fieldset disabled={disabled}>
        <ChangeOptionalFields register={register} />
      </fieldset>

      <fieldset disabled={disabled} className="space-y-2">
        <Field id="reason" label="Reason for this change" required error={errors.reason?.message}>
          <TextArea id="reason" {...register('reason')} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-6">
        <Button type="submit" disabled={disabled}>
          {isSubmitting ? 'Submitting…' : 'Submit change request'}
        </Button>
      </div>
    </form>
  )
}