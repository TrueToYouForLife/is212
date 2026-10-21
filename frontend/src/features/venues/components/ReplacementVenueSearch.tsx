import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VenueFilters } from './VenueFilters'
import { VenueResultCard } from './VenueResultCard'
import { ReplacementProposalForm } from './ReplacementProposalForm'
import { loadTimeSlots } from '../venueBookingService'
import { searchVenues } from '../venueSearchService'
import { loadLayoutTypes } from '../suitabilityService'
import type { AffectedVenueBooking } from '../venueReplacementService'
import type { TimeSlot } from '../slots'
import type { LayoutType } from '../suitabilityTypes'
import type { AssignedEventOption, Venue, VenueSearchFilters } from '../types'

export function ReplacementVenueSearch({ source, onBusyChange }: { source: AffectedVenueBooking; onBusyChange: (busy: boolean) => void }) {
  const initialFilters = useMemo<VenueSearchFilters>(() => ({
    keyword: '', location: '', date: '', slot: '', eventId: source.eventId,
    minAttendance: source.details.expectedAttendance == null ? '' : String(source.details.expectedAttendance),
    layout: source.details.layoutPreference ?? '', accessibility: [...source.details.accessibilityRequirements],
    facilities: [...source.details.facilityRequirements],
  }), [source])
  const [filters, setFilters] = useState(initialFilters)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [layouts, setLayouts] = useState<LayoutType[]>([])
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [target, setTarget] = useState<Venue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const search = useCallback(async (next: VenueSearchFilters, definitions: TimeSlot[]) => {
    const current = ++sequence.current
    setLoading(true); setVenues(null); setTarget(null); setError(null)
    try {
      const result = await searchVenues(next, definitions)
      if (current !== sequence.current) return
      if (result.ok) setVenues(result.venues)
      else setError(result.reason)
    } catch {
      if (current !== sequence.current) return
      setError('Replacement venues could not be searched. Reload and try again.')
    }
    if (current === sequence.current) setLoading(false)
  }, [])
  const invalidate = useCallback(() => { sequence.current++ }, [])
  // A changed source remounts the form; it never silently refreshes proposal consent.
  useEffect(() => {
    let cancelled = false
    void Promise.all([loadTimeSlots(), loadLayoutTypes()]).then(([definitions, types]) => {
      if (cancelled) return
      setSlots(definitions); setLayouts(types)
      if (definitions.length === 0) {
        setError('Booking times could not be loaded. Reload and try again.'); setLoading(false)
        return
      }
      void search(initialFilters, definitions)
    }).catch(() => {
      if (!cancelled) { setError('Search options could not be loaded. Reload and try again.'); setLoading(false) }
    })
    return () => { cancelled = true; invalidate() }
  }, [initialFilters, search, invalidate])
  const event: AssignedEventOption = {
    id: source.eventId, name: source.eventName, reference: null, ...source.details, equipmentRequirements: [],
  }
  if (target) return <ReplacementProposalForm source={source} target={target} onBusyChange={onBusyChange} onBack={() => setTarget(null)} />
  return <div className="space-y-4">
    <VenueFilters filters={filters} onChange={next => setFilters({ ...next, eventId: source.eventId, date: '', slot: '' })}
      onSearch={() => void search(filters, slots)} onClear={() => { setFilters(initialFilters); void search(initialFilters, slots) }}
      assignedEvents={[event]} layoutTypes={layouts} disabled={loading || slots.length === 0} searching={loading} eventLocked />
    {loading && <p role="status">Searching replacement venues…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {venues?.length === 0 && <p>No active venues match the event requirements and availability. Adjust the filters or reload later.</p>}
    {venues && venues.length > 0 && <>
      <p>Choose an alternative to request. Availability includes each venue’s setup and turnaround time and is checked again at approval.</p>
      <ul className="space-y-3">{venues.map(venue => <VenueResultCard key={venue.id} venue={venue} onSelect={() => setTarget(venue)} />)}</ul>
    </>}
  </div>
}
