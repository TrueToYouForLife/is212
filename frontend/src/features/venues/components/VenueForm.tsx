import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Field, TextInput } from '../../../components/ui/FormControls'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from '../venueFeatureCatalogue'
import type { FeatureOption } from '../venueFeatureCatalogue'
import {
  CLOSING_TIMES,
  EMPTY_VENUE_FORM,
  OPENING_TIMES,
  validateVenueForm,
} from '../venueManagementValidation'
import type { NewVenue, VenueFormErrors, VenueFormValues } from '../venueManagementValidation'

const selectClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  'aria-[invalid=true]:border-red-400'

const secondaryButtonClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 ' +
  'shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

function toggle(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter((item) => item !== code) : [...list, code]
}

function FeatureChecklist({
  legend,
  name,
  options,
  selected,
  onToggle,
}: {
  legend: string
  name: string
  options: readonly FeatureOption[]
  selected: string[]
  onToggle: (code: string) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.code} className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              name={name}
              value={option.code}
              checked={selected.includes(option.code)}
              onChange={() => onToggle(option.code)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * US46: a venue's details. Every problem is shown next to its field at once (AC-046.1,
 * AC-046.3), and nothing is sent until the form is valid.
 */
export function VenueForm({
  layoutOptions,
  onSubmit,
  submitting,
  serverError,
  submitLabel,
  initialValues = EMPTY_VENUE_FORM,
}: {
  layoutOptions: FeatureOption[]
  onSubmit: (venue: NewVenue) => void
  submitting: boolean
  serverError: string | null
  submitLabel: string
  initialValues?: VenueFormValues
}) {
  const [values, setValues] = useState<VenueFormValues>(initialValues)
  const [errors, setErrors] = useState<VenueFormErrors>({})

  const update = (changes: Partial<VenueFormValues>) => setValues((current) => ({ ...current, ...changes }))
  const updateLayout = (index: number, changes: Partial<VenueFormValues['layouts'][number]>) =>
    setValues((current) => ({
      ...current,
      layouts: current.layouts.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    }))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = validateVenueForm(values, layoutOptions.map((option) => option.code))
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    onSubmit(result.venue)
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="venue-name" label="Venue name" required error={errors.name}>
          <TextInput
            id="venue-name"
            value={values.name}
            aria-invalid={Boolean(errors.name)}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <Field id="venue-location" label="Location" required error={errors.location}>
          <TextInput
            id="venue-location"
            value={values.location}
            aria-invalid={Boolean(errors.location)}
            onChange={(e) => update({ location: e.target.value })}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Operating hours <span className="ml-1 text-red-600" aria-label="required">*</span>
        </legend>
        <p className="text-xs text-slate-500">
          Venues open and close on slot boundaries, so their hours cover whole AM, PM or Night slots.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="venue-opens" label="Opens at">
            <select
              id="venue-opens"
              className={selectClassName}
              value={values.opensAt}
              aria-invalid={Boolean(errors.hours)}
              onChange={(e) => update({ opensAt: e.target.value })}
            >
              <option value="">Choose a time</option>
              {OPENING_TIMES.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}
            </select>
          </Field>
          <Field id="venue-closes" label="Closes at">
            <select
              id="venue-closes"
              className={selectClassName}
              value={values.closesAt}
              aria-invalid={Boolean(errors.hours)}
              onChange={(e) => update({ closesAt: e.target.value })}
            >
              <option value="">Choose a time</option>
              {CLOSING_TIMES.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}
            </select>
          </Field>
        </div>
        {errors.hours && <p role="alert" className="text-xs text-red-600">{errors.hours}</p>}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">
          Layouts and capacity <span className="ml-1 text-red-600" aria-label="required">*</span>
        </legend>
        <p className="text-xs text-slate-500">
          Each layout the venue supports, with how many people it holds in that layout.
        </p>
        {values.layouts.map((row, index) => {
          const rowError = errors.layoutRows?.[index]
          return (
            <div key={index} className="space-y-1">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <select
                    aria-label={`Layout ${index + 1}`}
                    className={selectClassName}
                    value={row.layout}
                    aria-invalid={Boolean(rowError)}
                    onChange={(e) => updateLayout(index, { layout: e.target.value })}
                  >
                    <option value="">Choose a layout</option>
                    {layoutOptions.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <TextInput
                    aria-label={`Capacity for layout ${index + 1}`}
                    inputMode="numeric"
                    placeholder="Capacity"
                    value={row.capacity}
                    aria-invalid={Boolean(rowError)}
                    onChange={(e) => updateLayout(index, { capacity: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={values.layouts.length === 1}
                  onClick={() => update({ layouts: values.layouts.filter((_, i) => i !== index) })}
                >
                  Remove layout {index + 1}
                </button>
              </div>
              {rowError && <p role="alert" className="text-xs text-red-600">{rowError}</p>}
            </div>
          )
        })}
        <button
          type="button"
          className={secondaryButtonClassName}
          disabled={values.layouts.length >= layoutOptions.length}
          onClick={() => update({ layouts: [...values.layouts, { layout: '', capacity: '' }] })}
        >
          Add another layout
        </button>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <FeatureChecklist
          legend="Facilities"
          name="facilities"
          options={FACILITY_OPTIONS}
          selected={values.facilities}
          onToggle={(code) => update({ facilities: toggle(values.facilities, code) })}
        />
        <FeatureChecklist
          legend="Accessibility"
          name="accessibility"
          options={ACCESSIBILITY_OPTIONS}
          selected={values.accessibility}
          onToggle={(code) => update({ accessibility: toggle(values.accessibility, code) })}
        />
      </div>

      {serverError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {serverError}
        </div>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
