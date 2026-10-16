import { Field, TextInput } from '../../../components/ui/FormControls'
import { Button } from '../../../components/ui/Button'
import type { AssignedEventOption, VenueSearchFilters } from '../types'
import type { SlotCode } from '../slots'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from '../venueFeatureCatalogue'

// No features/facilities catalogue table exists yet — these are placeholder codes.
// Swap in your real catalogue once one exists.
const SLOT_OPTIONS: { value: SlotCode; label: string }[] = [
  { value: 'AM', label: 'AM (7am–12pm)' },
  { value: 'PM', label: 'PM (1pm–6pm)' },
  { value: 'NIGHT', label: 'Night (7pm–12am)' },
]

const selectClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-indigo-500/30 disabled:bg-slate-100'

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function VenueFilters({
  filters,
  onChange,
  onSearch,
  onClear,
  assignedEvents,
  disabled,
}: {
  filters: VenueSearchFilters
  onChange: (filters: VenueSearchFilters) => void
  onSearch: () => void
  onClear: () => void
  assignedEvents: AssignedEventOption[]
  disabled: boolean
}) {
  const selectedEvent = assignedEvents.find((event) => event.id === filters.eventId)

  const handleEventSelect = (eventId: string) => {
    const event = assignedEvents.find((candidate) => candidate.id === eventId)
    onChange({
      ...filters,
      eventId,
      date: '',
      slot: '',
      minAttendance:
        event?.expectedAttendance != null ? String(event.expectedAttendance) : filters.minAttendance,
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-5">
      <Field id="venue-search-event" label="Search for one of your events">
        <select
          id="venue-search-event"
          className={selectClassName}
          value={filters.eventId}
          disabled={disabled}
          onChange={(e) => handleEventSelect(e.target.value)}
        >
          <option value="">— Manual search —</option>
          {assignedEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.reference ?? event.name ?? event.id}
            </option>
          ))}
        </select>
      </Field>

      {selectedEvent && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p>This event&rsquo;s requested date and time decide which venues show as available.</p>
          {selectedEvent.layoutPreference && (
            <p className="mt-1">Requested layout: {selectedEvent.layoutPreference}</p>
          )}
          {selectedEvent.accessibilityRequirements && (
            <p className="mt-1">Requested accessibility: {selectedEvent.accessibilityRequirements}</p>
          )}
          {selectedEvent.equipmentRequirements && (
            <p className="mt-1">Requested equipment: {selectedEvent.equipmentRequirements}</p>
          )}
          <p className="mt-1 text-slate-500">
            These are free-text requirements from the event — match them to the layout,
            accessibility and facility filters below yourself.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="venue-search-keyword" label="Search by name or location">
          <TextInput
            id="venue-search-keyword"
            disabled={disabled}
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          />
        </Field>

        <Field id="venue-search-attendance" label="Expected attendance">
          <TextInput
            id="venue-search-attendance"
            type="number"
            min={1}
            disabled={disabled}
            value={filters.minAttendance}
            onChange={(e) => onChange({ ...filters, minAttendance: e.target.value })}
          />
        </Field>

        <Field id="venue-search-layout" label="Layout">
          <TextInput
            id="venue-search-layout"
            placeholder="e.g. theatre, banquet"
            disabled={disabled}
            value={filters.layout}
            onChange={(e) => onChange({ ...filters, layout: e.target.value })}
          />
        </Field>

        {!filters.eventId && (
          <>
            <Field id="venue-search-date" label="Date">
              <TextInput
                id="venue-search-date"
                type="date"
                disabled={disabled}
                value={filters.date}
                onChange={(e) => onChange({ ...filters, date: e.target.value })}
              />
            </Field>

            <Field id="venue-search-slot" label="Slot">
              <select
                id="venue-search-slot"
                className={selectClassName}
                disabled={disabled}
                value={filters.slot}
                onChange={(e) => onChange({ ...filters, slot: e.target.value as SlotCode | '' })}
              >
                <option value="">Any slot</option>
                {SLOT_OPTIONS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>

      <fieldset disabled={disabled}>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Accessibility
        </legend>
        <div className="flex flex-wrap gap-3">
          {ACCESSIBILITY_OPTIONS.map((option) => (
            <label key={option.code} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.accessibility.includes(option.code)}
                onChange={() =>
                  onChange({ ...filters, accessibility: toggle(filters.accessibility, option.code) })
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Facilities
        </legend>
        <div className="flex flex-wrap gap-3">
          {FACILITY_OPTIONS.map((option) => (
            <label key={option.code} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.facilities.includes(option.code)}
                onChange={() =>
                  onChange({ ...filters, facilities: toggle(filters.facilities, option.code) })
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Button type="button" onClick={onClear} disabled={disabled}>Clear filters</Button>
        <Button type="button" onClick={onSearch} disabled={disabled}>
          {disabled ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </div>
  )
}