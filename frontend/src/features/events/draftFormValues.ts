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

export function draftFormValues(draft: LoadedEventDraft): EventRequestFormValues {
  const values = draft.values
  return {
    name: values.name ?? '', purpose: values.purpose ?? '',
    eventType: values.eventType ?? '', description: values.description ?? '',
    proposedStart: toDateTimeInput(values.proposedStart),
    proposedEnd: toDateTimeInput(values.proposedEnd),
    expectedAttendance: String(values.expectedAttendance ?? ''),
    programme: values.programme ?? '', layoutPreference: values.layoutPreference ?? '',
    accessibilityRequirements: values.accessibilityRequirements ?? '',
    equipmentRequirements: values.equipmentRequirements ?? '',
    registrationRequired: values.registrationRequired ?? false,
    specialArrangements: values.specialArrangements ?? '',
  }
}
