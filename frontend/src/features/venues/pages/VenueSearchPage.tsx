import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { FEATURES } from '../../../lib/features'
import { useCurrentUser } from '../../auth/sessionContext'
import { VenueFilters } from '../components/VenueFilters'
import { VenueResultCard } from '../components/VenueResultCard'
import { searchVenues, listMyAssignedEvents } from '../venueSearchService'
import { loadTimeSlots } from '../venueBookingService.ts'
import { assessVenuesForEvent } from '../suitabilityService'
import type { VenueAssessment } from '../suitabilityTypes'
import type { AssignedEventOption, Venue, VenueSearchFilters as Filters } from '../types'
import type { TimeSlot } from '../slots'

const emptyFilters: Filters = {
  keyword: '', location: '', minAttendance: '', layout: '',
  accessibility: [], facilities: [], date: '', slot: '', eventId: '',
}

/**
 * AC-008. Every active venue is shown by default; each filter narrows the list. The date/slot
 * and "search for this event" filters exclude a venue using the same rule that actually
 * guards a booking (event slots plus the trailing setup/turnaround slot), so a venue shown
 * here is genuinely bookable, not just superficially free.
 */
export function VenueSearchPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [assignedEvents, setAssignedEvents] = useState<AssignedEventOption[]>([])
  const [assessments, setAssessments] = useState<Map<string, VenueAssessment>>(new Map())

  const isCoordinator = profile?.role === 'coordinator'

  const runSearch = useCallback(async (toSearch: Filters, slotDefs: TimeSlot[]) => {
    setLoading(true)
    setError(null)
    setAssessments(new Map())
    const result = await searchVenues(toSearch, slotDefs)
    if (result.ok) {
      setVenues(result.venues)
      // US18: when the search is for one of the coordinator's events, show how each result fits it.
      // If that check fails the search results still stand; the suitability page shows the error.
      if (FEATURES.venueSuitability && toSearch.eventId && result.venues.length > 0) {
        const assessed = await assessVenuesForEvent(
          toSearch.eventId,
          slotDefs,
          result.venues.map((venue) => venue.id),
        )
        if (assessed.ok) setAssessments(new Map(assessed.value.map((item) => [item.venue.id, item])))
      }
    } else {
      setError(result.reason)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isCoordinator) return
    let cancelled = false
    async function init() {
      const [slotDefs, events] = await Promise.all([loadTimeSlots(), listMyAssignedEvents()])
      if (cancelled) return
      setSlots(slotDefs)
      setAssignedEvents(events)
      await runSearch(emptyFilters, slotDefs)
    }
    init()
    return () => { cancelled = true }
  }, [isCoordinator, runSearch])

  const handleSearch = () => runSearch(filters, slots)
  const handleClear = () => {
    setFilters(emptyFilters)
    runSearch(emptyFilters, slots)
  }

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Event coordinator
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Search venues</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Every active venue is listed below. Narrow the list with the filters, or search
          using one of your assigned events.
        </p>
      </div>

      {userLoading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !isCoordinator ? (
        <Card title="Not available for your role">
          <p className="text-sm text-slate-600">
            Venue search is available to event coordinators.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <VenueFilters
            filters={filters}
            onChange={setFilters}
            onSearch={handleSearch}
            onClear={handleClear}
            assignedEvents={assignedEvents}
            disabled={loading}
          />

          {loading ? (
            <p className="text-sm text-slate-500">Searching venues…</p>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          ) : !venues || venues.length === 0 ? (
            <Card title="No venues match">
              <p className="text-sm text-slate-600">
                No active venues match these filters. Try clearing one or two of them.
              </p>
            </Card>
          ) : (
            <ul className="space-y-4">
              {venues.map((venue) => (
                <VenueResultCard
                    key={venue.id}
                    venue={venue}
                    assessment={assessments.get(venue.id)}
                    eventId={filters.eventId || undefined}
                  />
              ))}
            </ul>
          )}
        </div>
      )}
    </PageContainer>
  )
}