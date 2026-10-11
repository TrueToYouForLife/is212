import { useEffect, useRef, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/FormControls'
import { PageContainer } from '../../../components/layout/PageContainer'
import { FEATURES } from '../../../lib/features'
import { useCurrentUser } from '../../auth/sessionContext'
import { AvailabilityLegend, VenueAvailabilityGrid } from '../components/VenueAvailabilityGrid'
import { shiftDate, todayInSingapore } from '../availabilityDates'
import { getVenueAvailability } from '../venueAvailabilityService'
import { loadTimeSlots } from '../venueBookingService'
import type { TimeSlot } from '../slots'
import type { VenueAvailability } from '../venueAvailability'

const DAYS_SHOWN = 7

const inputClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

const weekButtonClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 ' +
  'shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

/**
 * US19: every venue's availability for a week, for Venue Staff and Event Coordinators.
 * Read-only: holds are placed from a venue's own timetable, which coordinators reach by
 * the venue's name.
 */
export function VenueAvailabilityPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const role = profile?.role
  const canView = role === 'venue_staff' || role === 'coordinator'

  const [fromDate, setFromDate] = useState(() => todayInSingapore())
  const [availability, setAvailability] = useState<VenueAvailability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Slot times never change while the page is open, so they are read once and reused.
  const slotsRef = useRef<TimeSlot[] | null>(null)

  useEffect(() => {
    if (userLoading || !canView) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const slots = slotsRef.current ?? await loadTimeSlots()
      // An empty list means the read failed; keep trying it rather than caching the failure.
      slotsRef.current = slots.length > 0 ? slots : null
      const result = await getVenueAvailability(slots, fromDate, DAYS_SHOWN)
      if (cancelled) return
      if (result.ok) {
        setAvailability(result.availability)
        setError(null)
      } else {
        setAvailability(null)
        setError(result.reason)
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [userLoading, canView, fromDate])

  if (userLoading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Checking your session…</p>
      </PageContainer>
    )
  }

  if (!canView) {
    return (
      <PageContainer>
        <Card title="Venue availability">
          <p className="text-sm text-slate-600">
            Venue availability is available to Venue Staff and Event Coordinators.
          </p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Venue availability</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Every venue for the week, in three slots a day: AM (7am to 12pm), PM (1pm to 6pm) and
          Night (7pm to 12am). Retired venues are not shown.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field id="availability-from" label="Week beginning">
            <input
              id="availability-from"
              type="date"
              className={inputClassName}
              value={fromDate}
              onChange={(e) => { if (e.target.value) setFromDate(e.target.value) }}
            />
          </Field>
        </div>
        <button type="button" className={weekButtonClassName} onClick={() => setFromDate((d) => shiftDate(d, -DAYS_SHOWN))}>
          Previous week
        </button>
        <button type="button" className={weekButtonClassName} onClick={() => setFromDate(todayInSingapore())}>
          This week
        </button>
        <button type="button" className={weekButtonClassName} onClick={() => setFromDate((d) => shiftDate(d, DAYS_SHOWN))}>
          Next week
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : loading || !availability ? (
        <p className="text-sm text-slate-500">Loading availability…</p>
      ) : availability.rows.length === 0 ? (
        <Card title="No venues to show">
          <p className="text-sm text-slate-600">There are no active venues yet.</p>
        </Card>
      ) : (
        <Card title="Availability">
          <div className="mb-4">
            <AvailabilityLegend />
          </div>
          <VenueAvailabilityGrid
            availability={availability}
            linkVenues={role === 'coordinator' && FEATURES.venueBooking}
          />
        </Card>
      )}
    </PageContainer>
  )
}
