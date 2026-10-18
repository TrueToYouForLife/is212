import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import { draftFormValues } from '../draftFormValues'
import { getEventPlanning, updateEventPlanning } from '../planningUpdateService'
import type { PlanningDetails } from '../planningUpdateService'
import { loadRequirementCatalogue } from '../requirementCatalogueService'
import type { RequirementCatalogue } from '../requirementCatalogue'
import { validateEventRequest } from '../validation'
import type { EventRequestFormValues } from '../types'
import { OptionalRequirementsFields } from './OptionalRequirementsFields'

const labels: Record<string, string> = {
  name: 'Event name', purpose: 'Purpose of the event', eventType: 'Type of event',
  description: 'Description', proposedStart: 'Preferred start', proposedEnd: 'Preferred end',
  expectedAttendance: 'Expected number of attendees', programme: 'General programme',
  layoutPreference: 'Room layout preference', accessibilityRequirements: 'Accessibility requirements',
  facilityRequirements: 'Facilities', equipmentRequirements: 'Equipment', specialArrangements: 'Special arrangements',
}

function showValue(value: unknown): string {
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return 'None'
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function PlanningEditor({ eventId, details, catalogue, onSaved }: {
  eventId: string; details: PlanningDetails; catalogue: RequirementCatalogue; onSaved: (message: string) => void
}) {
  const initial = Object.fromEntries(Object.entries(details.values).map(([key, value]) => [key, value ?? undefined]))
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<EventRequestFormValues>({
    defaultValues: draftFormValues({ id: eventId, status: 'draft', updatedAt: '', values: initial }),
  })
  const [error, setSaveError] = useState<string | null>(null)
  const busy = useRef(false)
  const save = handleSubmit(async values => {
    if (busy.current) return
    const codes = { layouts: catalogue.layouts.map(x => x.code), equipment: catalogue.equipment.map(x => x.code) }
    const valid = validateEventRequest(values, { codes })
    if (!valid.ok) {
      for (const issue of valid.issues) setError(issue.field === 'form' ? 'root' : issue.field, { message: issue.message })
      return
    }
    busy.current = true
    setSaveError(null)
    try {
      const result = await updateEventPlanning(eventId, details.version, values, codes)
      if (result.ok) onSaved(result.changed ? 'Planning details saved.' : 'No changes to save.')
      else setSaveError(result.reason)
    } finally { busy.current = false }
  })
  return <form onSubmit={save} noValidate className="space-y-4">
    <p className="text-sm text-slate-600">Changes are recorded in history. Affected venue and equipment arrangements will be flagged for review; existing reservations stay in place.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={isSubmitting} className="space-y-4">
      {(['name', 'purpose', 'eventType', 'description', 'proposedStart', 'proposedEnd', 'expectedAttendance'] as const).map(key =>
        <Field key={key} id={`planning-${key}`} label={labels[key]} error={errors[key]?.message}>
          {key === 'purpose' || key === 'description' ? <TextArea id={`planning-${key}`} {...register(key)} /> : <TextInput id={`planning-${key}`} {...register(key)}
            type={key.startsWith('proposed') ? 'datetime-local' : key === 'expectedAttendance' ? 'number' : 'text'}
            step={key.startsWith('proposed') ? 'any' : undefined} />}
        </Field>)}
      <OptionalRequirementsFields register={register} control={control} errors={errors} catalogue={catalogue} showRegistration={false} />
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save planning details'}</Button>
    </fieldset>
  </form>
}

/** Explicit reload preserves unsaved text until the coordinator chooses to discard it. */
export function PlanningUpdatePanel({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const [reload, setReload] = useState(0)
  const [state, setState] = useState<{ details: PlanningDetails; catalogue: RequirementCatalogue | null; catalogueError: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([getEventPlanning(eventId), loadRequirementCatalogue()]).then(([result, options]) => {
      if (!active) return
      if (!result.ok) { setState(null); setError(result.reason) }
      else setState({ details: result.value, catalogue: options.ok ? options.catalogue : null, catalogueError: options.ok ? null : options.reason })
    }).catch(() => { if (active) { setState(null); setError('Planning details could not be loaded. Please reload.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId, reload])
  return <div className="space-y-4">
    <Button type="button" disabled={loading} onClick={() => { setMessage(null); setReload(n => n + 1) }}>Reload planning details (discards unsaved edits)</Button>
    {message && <p role="status">{message}</p>}
    {loading ? <p>Loading planning details…</p> : error ? <p role="alert">{error}</p> : state && <>
      {state.catalogueError && <p role="alert">{state.catalogueError}</p>}
      {['approved', 'planning'].includes(state.details.status) ? state.catalogue && <PlanningEditor
        key={`${eventId}:${reload}`} eventId={eventId} details={state.details} catalogue={state.catalogue}
        onSaved={text => { setMessage(text); setReload(n => n + 1); onChanged() }} />
        : <p>Planning details can only be edited while the event is Approved or Planning.</p>}
      <h3 className="font-semibold">Planning update history (oldest first)</h3>
      {state.details.history.length === 0 ? <p>No planning updates recorded.</p> : <ol className="space-y-4">
        {state.details.history.map(item => <li key={item.id} className="rounded border p-3">
          <p>{item.changed_by_name} — {new Date(item.changed_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} (Singapore)</p>
          <ul>{Object.entries(item.changes).map(([field, change]) => <li key={field}>
            {labels[field] ?? field}: {showValue(change.before)} → {showValue(change.after)}
          </li>)}</ul>
        </li>)}
      </ol>}
    </>}
  </div>
}
