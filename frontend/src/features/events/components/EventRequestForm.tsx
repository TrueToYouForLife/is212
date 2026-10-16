import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { useEventRequestForm } from '../useEventRequestForm'
import { OptionalRequirementsFields } from './OptionalRequirementsFields'
import { SubmissionResult } from './SubmissionResult'
import { DraftSaveResult } from './DraftSaveResult'
import { StatusBadge } from './StatusBadge'
import type { LoadedEventDraft } from '../types'

export function EventRequestForm({ initialDraft }: { initialDraft?: LoadedEventDraft }) {
  const {
    register, errors, result, draftResult, draftId, resultRef,
    onSubmit, onSaveDraft, onChange, isSaving, isSubmitting, disabled,
  } = useEventRequestForm(initialDraft)

  if (initialDraft && result?.ok) return <SubmissionResult result={result} />

  return (
    <form onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-6">
      <div ref={resultRef}>
        <SubmissionResult result={result} />
        <DraftSaveResult result={draftResult} />
      </div>

      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">About the event</legend>

        <Field id="name" label="Event name">
          <TextInput id="name" {...register('name')} />
        </Field>

        <Field id="purpose" label="Purpose of the event" required error={errors.purpose?.message}>
          <TextArea
            id="purpose"
            aria-invalid={Boolean(errors.purpose)}
            {...register('purpose')}
          />
        </Field>

        <Field id="eventType" label="Type of event">
          <TextInput
            id="eventType"
            placeholder="Conference, gala dinner, workshop…"
            {...register('eventType')}
          />
        </Field>

        <Field id="description" label="Description">
          <TextArea id="description" {...register('description')} />
        </Field>
      </fieldset>

      <fieldset disabled={disabled} className="space-y-4">
        <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">When and how many</legend>

        {/* Start and end read as one decision, so they sit on one row where there is space. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="proposedStart"
            label="Preferred start"
            required
            error={errors.proposedStart?.message}
          >
            <TextInput
              id="proposedStart"
              type="datetime-local"
              step="any"
              aria-invalid={Boolean(errors.proposedStart)}
              {...register('proposedStart')}
            />
          </Field>

          <Field
            id="proposedEnd"
            label="Preferred end"
            required
            error={errors.proposedEnd?.message}
          >
            <TextInput
              id="proposedEnd"
              type="datetime-local"
              step="any"
              aria-invalid={Boolean(errors.proposedEnd)}
              {...register('proposedEnd')}
            />
          </Field>
        </div>

        <Field
          id="expectedAttendance"
          label="Expected number of attendees"
          required
          error={errors.expectedAttendance?.message}
        >
          <TextInput
            id="expectedAttendance"
            type="number"
            min={1}
            aria-invalid={Boolean(errors.expectedAttendance)}
            {...register('expectedAttendance')}
          />
        </Field>
      </fieldset>

      <fieldset disabled={disabled}>
        <OptionalRequirementsFields register={register} />
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-6">
        <p className="mr-auto text-xs text-slate-500">
          Save an unfinished draft, or submit when the required details are complete.
        </p>
        {draftId && <StatusBadge status="draft" />}
        <Button type="button" disabled={disabled} onClick={onSaveDraft}>
          {isSaving ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button type="submit" disabled={disabled}>
          {isSubmitting ? 'Submitting…' : 'Submit event request'}
        </Button>
      </div>
    </form>
  )
}
