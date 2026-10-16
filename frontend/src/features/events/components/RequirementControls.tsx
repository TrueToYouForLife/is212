import { Checkbox, Field } from '../../../components/ui/FormControls'
import { toggleCode } from '../requirementCatalogue'
import type { FeatureOption } from '../requirementCatalogue'

const selectClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-indigo-500/30 disabled:bg-slate-100'

/**
 * The two controls every fixed requirement uses, shared by the request form and the
 * change request form so the two cannot offer different options for the same field.
 * Presentation only: no React Hook Form, no Supabase, no validation.
 */

interface CodeSelectProps {
  id: string
  label: string
  options: readonly FeatureOption[]
  value: string
  onChange: (code: string) => void
  /** Shown as the first option. "No preference" for a request, "Keep current" for a change. */
  emptyLabel: string
  hint?: string
  error?: string
}

export function CodeSelect({
  id, label, options, value, onChange, emptyLabel, hint, error,
}: CodeSelectProps) {
  // A code that is not in the loaded list is still offered, selected, so an option
  // retired after this event was saved cannot silently change what the organiser asked
  // for just because they opened the form.
  const unknown = value !== '' && !options.some((option) => option.code === value)

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={selectClassName}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
        {unknown && <option value={value}>{value} (no longer offered)</option>}
      </select>
    </Field>
  )
}

interface CodeChecklistProps {
  /** Prefixes each checkbox id, so every box has a unique, testable id. */
  idPrefix: string
  legend: string
  options: readonly FeatureOption[]
  value: readonly string[]
  onChange: (codes: string[]) => void
  hint?: string
  error?: string
  /** Shown instead of the boxes when the catalogue has not loaded. */
  emptyMessage?: string
}

export function CodeChecklist({
  idPrefix, legend, options, value, onChange, hint, error, emptyMessage,
}: CodeChecklistProps) {
  // Same reasoning as CodeSelect: a retired code that is already stored stays visible and
  // tickable, so the organiser can see it and choose whether to drop it.
  const retired = value.filter((code) => !options.some((option) => option.code === code))

  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-medium text-slate-700">{legend}</legend>

      {options.length === 0 && retired.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage ?? 'No options are available.'}</p>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {options.map((option) => (
            <label
              key={option.code}
              htmlFor={`${idPrefix}-${option.code}`}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <Checkbox
                id={`${idPrefix}-${option.code}`}
                checked={value.includes(option.code)}
                onChange={() => onChange(toggleCode(value, option.code))}
              />
              {option.label}
            </label>
          ))}
          {retired.map((code) => (
            <label
              key={code}
              htmlFor={`${idPrefix}-${code}`}
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <Checkbox
                id={`${idPrefix}-${code}`}
                checked
                onChange={() => onChange(toggleCode(value, code))}
              />
              {code} (no longer offered)
            </label>
          ))}
        </div>
      )}

      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </fieldset>
  )
}
