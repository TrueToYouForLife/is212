import type { UseFormRegister } from 'react-hook-form'
import { Checkbox, Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import type { EventRequestFormValues } from '../types'

interface OptionalRequirementsFieldsProps {
  register: UseFormRegister<EventRequestFormValues>
}

/**
 * The AC-005.1 fields an organiser may leave blank. Split out of EventRequestForm so the
 * form file stays about orchestration rather than markup.
 */
export function OptionalRequirementsFields({ register }: OptionalRequirementsFieldsProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Programme and requirements
      </legend>

      <Field id="programme" label="General programme">
        <TextArea
          id="programme"
          placeholder="Outline of the running order"
          {...register('programme')}
        />
      </Field>

      <Field id="layoutPreference" label="Room layout preference">
        <TextInput
          id="layoutPreference"
          placeholder="Theatre, classroom, banquet…"
          {...register('layoutPreference')}
        />
      </Field>

      <Field id="accessibilityRequirements" label="Accessibility requirements">
        <TextArea id="accessibilityRequirements" {...register('accessibilityRequirements')} />
      </Field>

      <Field id="equipmentRequirements" label="Equipment requirements">
        <TextArea
          id="equipmentRequirements"
          placeholder="Projector, microphones, stage lighting…"
          {...register('equipmentRequirements')}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox id="registrationRequired" {...register('registrationRequired')} />
        <label htmlFor="registrationRequired" className="text-sm text-slate-700">
          Attendees must register for this event
        </label>
      </div>

      <Field id="specialArrangements" label="Other special arrangements">
        <TextArea id="specialArrangements" {...register('specialArrangements')} />
      </Field>
    </fieldset>
  )
}
