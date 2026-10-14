import { Controller } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { Checkbox, Field, TextArea } from '../../../components/ui/FormControls'
import { CodeChecklist, CodeSelect } from './RequirementControls'
import type { EventRequestFormValues } from '../types'
import type { RequirementCatalogue } from '../requirementCatalogue'

interface OptionalRequirementsFieldsProps {
  register: UseFormRegister<EventRequestFormValues>
  control: Control<EventRequestFormValues>
  catalogue: RequirementCatalogue
  errors: FieldErrors<EventRequestFormValues>
  /** Set when the catalogues could not be loaded, so the organiser is told why the
   *  layout and equipment lists are empty instead of assuming there are no options. */
  catalogueError?: string | null
}

/**
 * The AC-005.1 fields an organiser may leave blank. Split out of EventRequestForm so the
 * form file stays about orchestration rather than markup.
 *
 * Layout, accessibility, facilities and equipment are fixed choices rather than free
 * text: they are the fields a coordinator has to match against a venue, and text like
 * "Theatre, maybe banquet?" cannot be matched against anything. The three code lists use
 * Controller because register() only handles a single input's value, not a set of
 * checkboxes that together make one array.
 */
export function OptionalRequirementsFields({
  register, control, catalogue, errors, catalogueError,
}: OptionalRequirementsFieldsProps) {
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
            label="Room layout preference"
            options={catalogue.layouts}
            value={field.value}
            onChange={field.onChange}
            emptyLabel="No preference"
            hint="The coordinator matches this to a venue's layouts."
            error={errors.layoutPreference?.message}
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
            hint="Only venues with everything you tick will be offered."
            error={errors.accessibilityRequirements?.message}
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
            hint="Built into the room. Anything to be brought in belongs under equipment."
            error={errors.facilityRequirements?.message}
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
            hint="Portable equipment, reserved separately from the venue."
            error={errors.equipmentRequirements?.message}
            emptyMessage="The equipment catalogue could not be loaded."
          />
        )}
      />

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
