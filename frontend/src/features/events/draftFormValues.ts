import type { EventRequestFormValues, LoadedEventDraft } from './types'

// datetime-local expects wall-clock time, not the UTC timestamp returned by Postgres.
// Match the existing submission parser's browser-local timezone and preserve seconds.
export function toDateTimeInput(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${String(date.getMilliseconds()).padStart(3, '0')}`
}

/** A stored requirement list becomes a fresh mutable array: the form owns its own copy,
 *  so ticking a box cannot write through to the loaded draft. */
function toCodeList(value?: readonly string[] | null): string[] {
  return value ? [...value] : []
}

export function draftFormValues(draft: LoadedEventDraft): EventRequestFormValues {
  const values = draft.values
  return {
    name: values.name ?? '', purpose: values.purpose ?? '',
    eventType: values.eventType ?? '', description: values.description ?? '',
    proposedStart: toDateTimeInput(values.proposedStart),
    proposedEnd: toDateTimeInput(values.proposedEnd),
    expectedAttendance: String(values.expectedAttendance ?? ''),
    programme: values.programme ?? '',
    // '' is the dropdown's "no preference" option, which validation turns back into null.
    layoutPreference: values.layoutPreference ?? '',
    accessibilityRequirements: toCodeList(values.accessibilityRequirements),
    facilityRequirements: toCodeList(values.facilityRequirements),
    equipmentRequirements: toCodeList(values.equipmentRequirements),
    registrationRequired: values.registrationRequired ?? false,
    specialArrangements: values.specialArrangements ?? '',
  }
}
