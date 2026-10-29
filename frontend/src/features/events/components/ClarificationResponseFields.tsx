import { toDateTimeInput } from '../draftFormValues'
import {
  CODE_LIST_REQUIREMENT_FIELDS,
  optionsForField,
  toggleCode,
} from '../requirementCatalogue'
import type { RequirementCatalogue } from '../requirementCatalogue'
import type { ClarificationValues } from '../clarificationResponseValidation'

/**
 * US37 AC-037.1: the revisable half of the clarification response form.
 *
 * Extracted from ClarificationResponseForm so neither file carries both the fourteen
 * fields and the submission logic. Controlled inputs rather than React Hook Form, matching
 * ChangeRequestReplyForm — this is a reply with revisions attached, not a second copy of
 * the request form, and the service does the validating.
 */
export function ClarificationResponseFields({ values, onChange, catalogue, disabled }: {
  values: ClarificationValues
  onChange: (patch: ClarificationValues) => void
  catalogue: RequirementCatalogue
  disabled: boolean
}) {
  const text = (field: 'name' | 'purpose' | 'eventType' | 'description' | 'programme'
    | 'specialArrangements', label: string, rows?: number) => (
    <label className="block text-sm">
      {label}
      {rows ? (
        <textarea value={values[field] ?? ''} rows={rows} disabled={disabled}
          onChange={(event) => onChange({ [field]: event.target.value })}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      ) : (
        <input type="text" value={values[field] ?? ''} disabled={disabled}
          onChange={(event) => onChange({ [field]: event.target.value })}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      )}
    </label>
  )

  return <div className="space-y-4">
    {text('name', 'Event name')}
    {text('purpose', 'Purpose')}
    {text('eventType', 'Event type')}

    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm">
        Preferred start
        {/* datetime-local works in wall-clock time; toDateTimeInput converts the stored
            UTC timestamp, and the value goes back as typed for the service to parse. */}
        <input type="datetime-local" disabled={disabled}
          value={toDateTimeInput(values.proposedStart ?? undefined)}
          onChange={(event) => onChange({
            proposedStart: event.target.value ? new Date(event.target.value).toISOString() : null,
          })}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm">
        Preferred end
        <input type="datetime-local" disabled={disabled}
          value={toDateTimeInput(values.proposedEnd ?? undefined)}
          onChange={(event) => onChange({
            proposedEnd: event.target.value ? new Date(event.target.value).toISOString() : null,
          })}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
    </div>

    <label className="block text-sm">
      Expected attendance
      {/* An emptied box is null, not 0: "I have not said" and "nobody is coming" are
          different answers, and the service refuses the first with a usable message. */}
      <input type="number" min={1} step={1} disabled={disabled}
        value={values.expectedAttendance ?? ''}
        onChange={(event) => onChange({
          expectedAttendance: event.target.value === '' ? null : Number(event.target.value),
        })}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
    </label>

    <label className="block text-sm">
      Room layout
      <select value={values.layoutPreference ?? ''} disabled={disabled}
        onChange={(event) => onChange({ layoutPreference: event.target.value || null })}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
        <option value="">No preference</option>
        {catalogue.layouts.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </label>

    {CODE_LIST_REQUIREMENT_FIELDS.map((field) => {
      const options = optionsForField(catalogue, field)
      const selected = values[field] ?? []
      return <fieldset key={field} disabled={disabled}>
        <legend className="text-sm font-medium text-slate-700">
          {field === 'accessibilityRequirements' ? 'Accessibility requirements'
            : field === 'facilityRequirements' ? 'Venue facilities' : 'Equipment'}
        </legend>
        {options.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">No options are available to choose from.</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {options.map((option) => (
              <label key={option.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(option.code)}
                  onChange={() => onChange({ [field]: toggleCode(selected, option.code) })} />
                {option.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    })}

    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={values.registrationRequired ?? false} disabled={disabled}
        onChange={(event) => onChange({ registrationRequired: event.target.checked })} />
      Attendees need to register for this event
    </label>

    {text('programme', 'Programme', 3)}
    {text('specialArrangements', 'Special arrangements', 3)}
    {text('description', 'Description', 3)}
  </div>
}
