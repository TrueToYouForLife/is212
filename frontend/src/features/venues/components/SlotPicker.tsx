import { Checkbox, Field } from '../../../components/ui/FormControls'
import { QUARTER_HOUR_OPTIONS } from '../quarterHourSlots'

interface SlotPickerProps {
  id: string
  startTime: string
  endTime: string
  onChange: (start: string, end: string) => void
  disabled?: boolean
  error?: string
}

/** The start time belongs to the start date; the end time belongs to the end date. */
export function SlotPicker({ id, startTime, endTime, onChange, disabled, error }: SlotPickerProps) {
  const fullDay = startTime === '00:00' && endTime === '24:00'
  const starts = QUARTER_HOUR_OPTIONS.map(option => option.label.split('–')[0])
  const ends = ['00:00', ...QUARTER_HOUR_OPTIONS.map(option => option.label.split('–')[1])]
  const selectClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100'
  return <fieldset disabled={disabled} aria-describedby={error ? `${id}-error` : `${id}-hint`}>
    <legend className="text-sm font-medium text-slate-700">Block times (Singapore time)</legend>
    <div className="mt-2 grid gap-4 sm:grid-cols-2">
      <Field id={`${id}-start`} label="Start time" required>
        <select id={`${id}-start`} className={selectClass} value={startTime} aria-invalid={Boolean(error)}
          onChange={event => onChange(event.target.value, endTime)}>
          <option value="">Choose start time</option>
          {starts.map(time => <option key={time} value={time}>{time}</option>)}
        </select>
      </Field>
      <Field id={`${id}-end`} label="End time" required>
        <select id={`${id}-end`} className={selectClass} value={endTime} aria-invalid={Boolean(error)}
          onChange={event => onChange(startTime, event.target.value)}>
          <option value="">Choose end time</option>
          {ends.map(time => <option key={time} value={time}>{time === '24:00' ? '24:00 (end of day)' : time}</option>)}
        </select>
      </Field>
    </div>
    <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-900">
      <Checkbox checked={fullDay} onChange={() => onChange(fullDay ? '' : '00:00', fullDay ? '' : '24:00')} />
      Full day
    </label>
    <p id={`${id}-hint`} className="mt-2 text-xs text-slate-500">Choose times in 15-minute intervals. One continuous period is blocked, including overnight and every day between the start and end.</p>
    {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>}
  </fieldset>
}
