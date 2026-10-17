import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/FormControls'
import { useCurrentUser } from '../../auth/sessionContext'
import { SuitabilityResultList } from '../components/SuitabilityResultList'
import { VenueRequirementsForm } from '../components/VenueRequirementsForm'
import type { TimeSlot } from '../slots'
import {
  assessVenuesForEvent, loadEventSuitability, loadLayoutTypes, saveVenueRequirements,
} from '../suitabilityService'
import type { LayoutType, SuitabilityEvent, VenueAssessment, VenueRequirements } from '../suitabilityTypes'
import type { AssignedEventOption } from '../types'
import { loadTimeSlots } from '../venueBookingService'
import { ACCESSIBILITY_OPTIONS, FACILITY_OPTIONS } from '../venueFeatureCatalogue'
import { listMyAssignedEvents } from '../venueSearchService'

/** Codes to words, for the organiser's own requirements shown above the form. */
function describeCodes(
  options: readonly { code: string; label: string }[],
  codes: readonly string[],
): string {
  return codes
    .map((code) => options.find((option) => option.code === code)?.label ?? code)
    .join(', ')
}

const selectClasses =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

/** US18: pick an event you coordinate, record its venue requirements, see which venues fit. */
export function VenueSuitabilityPage() {
  const { profile, loading } = useCurrentUser()
  const isCoordinator = profile?.role === 'coordinator'

  const [events, setEvents] = useState<AssignedEventOption[]>([])
  const [layoutTypes, setLayoutTypes] = useState<LayoutType[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [eventId, setEventId] = useState('')
  const [context, setContext] = useState<{ event: SuitabilityEvent; requirements: VenueRequirements } | null>(null)
  const [assessments, setAssessments] = useState<VenueAssessment[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCoordinator) return
    void Promise.all([listMyAssignedEvents(), loadLayoutTypes(), loadTimeSlots()]).then(
      ([myEvents, layouts, timeSlots]) => {
        setEvents(myEvents)
        setLayoutTypes(layouts)
        setSlots(timeSlots)
      },
    )
  }, [isCoordinator])

  const labels = useMemo(() => new Map(layoutTypes.map((type) => [type.code, type.label])), [layoutTypes])
  const layoutLabel = (code: string) => labels.get(code) ?? code

  async function refresh(id: string) {
    setError(null)
    const [loaded, assessed] = await Promise.all([loadEventSuitability(id), assessVenuesForEvent(id, slots)])
    if (!loaded.ok) {
      setContext(null)
      setAssessments([])
      setError(loaded.reason)
      return
    }
    setContext(loaded.value)
    if (!assessed.ok) {
      // Failing closed: show why, and offer no venue as free.
      setAssessments([])
      setError(assessed.reason)
      return
    }
    setAssessments(assessed.value)
  }

  function chooseEvent(id: string) {
    setEventId(id)
    setContext(null)
    setAssessments([])
    if (id) void refresh(id)
  }

  async function handleSave(requirements: VenueRequirements): Promise<string | null> {
    const result = await saveVenueRequirements(eventId, requirements)
    if (!result.ok) return result.reason
    await refresh(eventId)
    return null
  }

  if (loading) return null

  if (!isCoordinator) {
    return (
      <Card title="Venue suitability">
        <p className="text-sm text-slate-600">Venue suitability is available to Event Coordinators.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card title="Venue suitability" description="Check which venues fit an event you coordinate.">
        <Field id="suitability-event" label="Event">
          <select
            id="suitability-event"
            value={eventId}
            onChange={(event) => chooseEvent(event.target.value)}
            className={selectClasses}
          >
            <option value="">Choose an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.reference ? `${event.reference} — ` : ''}{event.name ?? 'Untitled event'}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {context && (
        <>
          <Card
            title="Requirements"
            description="The organiser's own words, and the structured version each venue is checked against."
          >
            <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Expected attendance</dt>
                <dd className="mt-0.5 text-slate-900">{context.event.expectedAttendance ?? 'Not given'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Organiser's layout request</dt>
                <dd className="mt-0.5 text-slate-900">
                  {context.event.layoutPreference
                    ? layoutLabel(context.event.layoutPreference)
                    : 'None'}
                </dd>
              </div>
              {/* Codes since 0054, so these read as labels from the shared catalogue
                  rather than as whatever the organiser once typed. */}
              <div>
                <dt className="text-slate-500">Organiser's accessibility needs</dt>
                <dd className="mt-0.5 text-slate-900">
                  {describeCodes(ACCESSIBILITY_OPTIONS, context.event.accessibilityRequirements) || 'None'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Organiser's facility needs</dt>
                <dd className="mt-0.5 text-slate-900">
                  {describeCodes(FACILITY_OPTIONS, context.event.facilityRequirements) || 'None'}
                </dd>
              </div>
            </dl>
            <VenueRequirementsForm
              key={context.event.id}
              layoutTypes={layoutTypes}
              initial={context.requirements}
              onSave={handleSave}
            />
          </Card>

          {!error && (
            <Card title="Venues">
              <SuitabilityResultList assessments={assessments} layoutLabel={layoutLabel} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}