import { Field, TextInput } from '../../../components/ui/FormControls'
import { Button } from '../../../components/ui/Button'
import type { AssignedEventOption, VenueSearchFilters } from '../types'
import type { LayoutType } from '../suitabilityTypes'
import type { SlotCode } from '../slots'
import { QUARTER_HOUR_OPTIONS } from '../quarterHourSlots'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS, featureLabel } from '../venueFeatureCatalogue'


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
  layoutTypes,
  disabled,
  eventLocked = false,
  searching = disabled,
}: {
  filters: VenueSearchFilters
  onChange: (filters: VenueSearchFilters) => void
  onSearch: () => void
  onClear: () => void
  assignedEvents: AssignedEventOption[]
  /** From layout_types (0021); empty until loaded, which only costs the dropdown. */
  layoutTypes: LayoutType[]
  disabled: boolean
  eventLocked?: boolean
  searching?: boolean
}) {
  const selectedEvent = assignedEvents.find((event) => event.id === filters.eventId)

  /**
   * Choosing an event copies its requirements straight into the filters. This is only
   * possible because the event stores the same catalogue codes the filters use (0054):
   * previously these were free text and the coordinator had to read them and tick the
   * matching boxes by hand, which is exactly where a requirement got lost.
   *
   * They are copied, not locked: the coordinator can still untick one to widen a search
   * that returns nothing, which is a normal thing to want and not a reason to make the
   * filters read-only. Clearing the event selection leaves them as they are, so an
   * adjusted search is not silently undone.
   */
  const handleEventSelect = (eventId: string) => {
    const event = assignedEvents.find((candidate) => candidate.id === eventId)
    if (!event) {
      onChange({ ...filters, eventId: '' })
      return
    }
    onChange({
      ...filters,
      eventId,
      date: '',
      slot: '',
      minAttendance:
        event.expectedAttendance != null ? String(event.expectedAttendance) : filters.minAttendance,
      layout: event.layoutPreference ?? '',
      accessibility: [...event.accessibilityRequirements],
      facilities: [...event.facilityRequirements],
    })
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-5">
      <Field id="venue-search-event" label="Search for one of your events">
        <select
          id="venue-search-event"
          className={selectClassName}
          value={filters.eventId}
          disabled={disabled || eventLocked}
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
          <p>
            This event&rsquo;s requested date and time decide which venues show as
            available, and its requirements have been applied to the filters below.
          </p>
          {selectedEvent.equipmentRequirements.length > 0 && (
            <p className="mt-1">
              Equipment requested:{' '}
              {selectedEvent.equipmentRequirements.join(', ')} — reserved separately, so
              it is not a venue filter.
            </p>
          )}
          <p className="mt-1 text-slate-500">
            Untick a requirement below to widen the search.
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
          <select
            id="venue-search-layout"
            className={selectClassName}
            disabled={disabled}
            value={filters.layout}
            onChange={(e) => onChange({ ...filters, layout: e.target.value })}
          >
            <option value="">Any layout</option>
            {layoutTypes.map((type) => (
              <option key={type.code} value={type.code}>{type.label}</option>
            ))}
            {/* An event may ask for a layout the catalogue no longer lists; keep it
                selectable rather than silently dropping the requirement. */}
            {filters.layout !== '' && !layoutTypes.some((type) => type.code === filters.layout) && (
              <option value={filters.layout}>{filters.layout}</option>
            )}
          </select>
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

            <Field id="venue-search-slot" label="Slot (Singapore time)">
              <select
                id="venue-search-slot"
                className={selectClassName}
                disabled={disabled}
                value={filters.slot}
                onChange={(e) => onChange({ ...filters, slot: e.target.value as SlotCode | '' })}
              >
                <option value="">Any slot</option>
                {QUARTER_HOUR_OPTIONS.map((slot) => (
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

      {selectedEvent && (
        <p className="text-xs text-slate-500">
          Applied from {selectedEvent.reference ?? selectedEvent.name ?? 'the selected event'}:{' '}
          {[
            selectedEvent.layoutPreference ? `layout ${selectedEvent.layoutPreference}` : null,
            selectedEvent.accessibilityRequirements
              .map((code) => featureLabel(ACCESSIBILITY_OPTIONS, code)).join(', ') || null,
            selectedEvent.facilityRequirements
              .map((code) => featureLabel(FACILITY_OPTIONS, code)).join(', ') || null,
          ].filter(Boolean).join(' · ') || 'no specific requirements'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <Button type="button" onClick={onClear} disabled={disabled}>Clear filters</Button>
        <Button type="button" onClick={onSearch} disabled={disabled}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </div>
    </div>
  )
}
