import { Controller } from 'react-hook-form'
import type { Control, UseFormRegister } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { CodeChecklist, CodeSelect } from './RequirementControls'
import { useEventChangeRequestForm, NO_CURRENT_REQUIREMENTS } from '../useEventChangeRequestForm'
import type { ChangeRequestCurrentValues, ChangeRequestFormValues } from '../useEventChangeRequestForm'
import type { RequestEventChangeResult } from '../eventChangeRequestService'
import type { RequirementCatalogue } from '../requirementCatalogue'

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
      <Field id="specialArrangements" label="Special arrangements">
        <TextArea id="specialArrangements" placeholder="Leave blank to keep current" {...register('specialArrangements')} />
      </Field>
    </div>
  )
}

/**
 * The requirement controls start at the event's current values, unlike the free-text
 * fields which start blank. The two behave differently because they have to: a blank
 * text box is unambiguously "I am not proposing anything here", but a blank dropdown or
 * an empty checkbox group is a real proposal, so the only way to say "no change" with a
 * fixed control is to leave it as it was shown. Nothing is submitted unless it differs
 * from what is displayed here.
 */
function ChangeRequirementFields({
  control, catalogue, catalogueError,
}: {
  control: Control<ChangeRequestFormValues>
  catalogue: RequirementCatalogue
  catalogueError: string | null
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        These show what the event asks for today. Change only what you want reviewed —
        anything you leave as it is will not be proposed.
      </p>

      {catalogueError && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {catalogueError}
        </p>
      )}

      <Controller
        control={control}
        name="layoutPreference"
        render={({ field }) => (
          <CodeSelect
            id="layoutPreference"
            label="Room layout"
            options={catalogue.layouts}
            value={field.value}
            onChange={field.onChange}
            emptyLabel="No preference"
          />
        )}
      />

      <Controller
        control={control}
        name="accessibilityRequirements"
        render={({ field }) => (
          <CodeChecklist
            idPrefix="accessibilityRequirements"
            legend="Accessibility requirements"
            options={catalogue.accessibility}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="facilityRequirements"
        render={({ field }) => (
          <CodeChecklist
            idPrefix="facilityRequirements"
            legend="Facilities the venue must have"
            options={catalogue.facilities}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="equipmentRequirements"
        render={({ field }) => (
          <CodeChecklist
            idPrefix="equipmentRequirements"
            legend="Equipment to be provided"
            options={catalogue.equipment}
            value={field.value}
            onChange={field.onChange}
            emptyMessage="The equipment catalogue could not be loaded."
          />
        )}
      />
    </div>
  )
}

export function EventChangeRequestForm({
  eventId,
  current = NO_CURRENT_REQUIREMENTS,
}: {
  eventId: string
  current?: ChangeRequestCurrentValues
}) {
  const {
    register, control, errors, result, resultRef, catalogue, catalogueError,
    onSubmit, isSubmitting, disabled,
  } = useEventChangeRequestForm(eventId, current)

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

      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Programme and requirements
        </legend>
        <ChangeOptionalFields register={register} />
        <ChangeRequirementFields
          control={control}
          catalogue={catalogue}
          catalogueError={catalogueError}
        />
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
