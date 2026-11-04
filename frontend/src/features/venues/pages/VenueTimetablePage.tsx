import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Field } from '../../../components/ui/FormControls'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { BookingTimeSummary } from '../components/BookingTimeSummary'
import { BookingSpaceFields } from '../components/BookingSpaceFields'
import { spaceError } from '../bookingSpaceService'
import { VenueTimetableGrid } from '../components/VenueTimetableGrid'
import { UnsuitableVenueAlert } from '../components/UnsuitableVenueAlert'
import { assessVenueForBooking } from '../suitabilityService'
import type { VenueAssessment, SuitabilityReasonCode } from '../suitabilityTypes'
import { occupiedVenueCells } from '../venueOccupiedSlots'
import type { VenueWithBuffers } from '../venueTimetableService'
import type { ClaimCell, TimeSlot } from '../slots'
import { canBookForEventStatus } from '../holdRules'
import { getVenue, getVenueTimetable } from '../venueTimetableService'
import { VENUE_BOOKING_MESSAGES, holdVenue, loadTimeSlots } from '../venueBookingService'
import { listMyAssignedEvents } from '../venueSearchService'
import type { AssignedEventOption } from '../types'
import type { VenueTimetable } from '../bookingTypes'

const DAYS_SHOWN = 7

const selectClassName =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 ' +
  'focus:ring-indigo-500/30 disabled:bg-slate-100'

function todayInSingapore(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

/**
 * Judged against the event's total attendance by assessVenueForBooking, which is the wrong
 * number once a booking declares its own space (US49). A breakout room for 20 people is not
 * unsuitable because the whole event expects 200. US49's check_booking_space (0102) compares the
 * venue's layout capacity against the attendance this booking declares and refuses with 22023,
 * so the right comparison is already enforced; repeating the event-level one here would warn on
 * every room of a multi-venue event and teach coordinators to dismiss the alert unread.
 */
const JUDGED_PER_BOOKING: SuitabilityReasonCode[] = ['capacity', 'layout']

/**
 * Reasons the database refuses outright, so "Book anyway" could not succeed: the slot ledger's
 * primary key, the venue's status and the event's timing. Offering an override for these would
 * produce the bare SQL error the alert exists to replace.
 *
 * `accessibility` and `facility` are deliberately absent. They belong to the organiser's stated
 * requirements, which US18 AC-018.2 treats as advice — "an unsuitable venue can still be booked
 * once the coordinator has seen why it does not fit" — and 0125 made check_booking_space agree,
 * so AC-011.10's "Book anyway" is honoured for them. Venue Staff remain the control: they review
 * every request and can reject one whose venue does not meet the requirements (US10).
 */
const NOT_OVERRIDABLE: SuitabilityReasonCode[] = ['venue_status', 'booked', 'blocked', 'timing']

/**
 * The verdict to put in front of the coordinator, or null when nothing stands in the way of the
 * hold. Deliberately does not trust the assessment's own verdict: that was computed for a whole
 * event in venue search, and this is one booking.
 */
export function gateFor(assessment: VenueAssessment): VenueAssessment | null {
  const reasons = assessment.reasons.filter((reason) => !JUDGED_PER_BOOKING.includes(reason.code))
  if (reasons.length === 0) return null
  const blocked = reasons.some((reason) => NOT_OVERRIDABLE.includes(reason.code))
  // UnsuitableVenueAlert withholds "Book anyway" for 'unavailable', which is the behaviour an
  // un-overridable reason needs; 'unsuitable' keeps the override for anything that gains one.
  return { ...assessment, reasons, verdict: blocked ? 'unavailable' : 'unsuitable' }
}

/**
 * A venue's calendar, and the place a tentative hold is placed. Choosing one of the
 * coordinator's events highlights the slots that booking would take — its own, plus the
 * venue's setup and turnaround durations — rather than asking them to pick slots by
 * hand, because the event's times already decide them.
 */
export function VenueTimetablePage() {
  const { id: venueId = '' } = useParams()
  const [params] = useSearchParams()
  const { profile, loading: userLoading } = useCurrentUser()

  const [venue, setVenue] = useState<VenueWithBuffers | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [events, setEvents] = useState<AssignedEventOption[]>([])
  const [eventId, setEventId] = useState(params.get('eventId') ?? '')
  const [fromDate, setFromDate] = useState(todayInSingapore())
  const [timetable, setTimetable] = useState<VenueTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [heldBookingId, setHeldBookingId] = useState<string | null>(null)
  const [holding, setHolding] = useState(false)
  const [space, setSpace] = useState({ layout: '', attendance: 0 })
  // AC-011.10: the verdict waiting for the coordinator's answer. Null means either nothing has
  // been checked yet or the venue was suitable; the alert itself is what holds the decision.
  const [pendingAssessment, setPendingAssessment] = useState<VenueAssessment | null>(null)
  const [checking, setChecking] = useState(false)
  const busy = holding || checking

  const isCoordinator = profile?.role === 'coordinator'
  const selectedEvent = events.find((event) => event.id === eventId) ?? null

  const refreshTimetable = useCallback(async (slotDefs: TimeSlot[], start: string) => {
    const result = await getVenueTimetable(venueId, slotDefs, start, DAYS_SHOWN)
    if (result.ok) {
      setTimetable(result.timetable)
      setError(null)
    } else {
      setTimetable(null)
      setError(result.reason)
    }
  }, [venueId])

  useEffect(() => {
    if (userLoading || !isCoordinator) return
    let cancelled = false
    async function init() {
      setLoading(true)
      const [venueResult, slotDefs, assigned] = await Promise.all([
        getVenue(venueId), loadTimeSlots(), listMyAssignedEvents(),
      ])
      if (cancelled) return
      if (venueResult.ok) setVenue(venueResult.venue)
      else setError(venueResult.reason)
      setSlots(slotDefs)
      setEvents(assigned)
      await refreshTimetable(slotDefs, fromDate)
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
    // fromDate is handled by its own effect below; re-running init on it would refetch the venue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, isCoordinator, venueId, refreshTimetable])

  /** The cells this event's booking would occupy, recomputed whenever the choice changes. */
  const preview = useMemo<{ cells: ClaimCell[]; error: string | null }>(() => {
    if (!selectedEvent) return { cells: [], error: null }
    if (!venue || slots.length === 0) return { cells: [], error: 'Booking timing could not be loaded. Please reload.' }
    try {
      if (!selectedEvent.proposedStart || !selectedEvent.proposedEnd) throw new Error('Missing timing')
      return { cells: occupiedVenueCells(new Date(selectedEvent.proposedStart), new Date(selectedEvent.proposedEnd), venue), error: null }
    } catch {
      return { cells: [], error: 'The event timing or venue setup/turnaround durations are invalid. Please review them before booking.' }
    }
  }, [selectedEvent, venue, slots])
  const plannedCells = preview.cells

  const selectedKeys = useMemo(
    () => new Set(plannedCells.map((cell) => `${cell.date}|${cell.slot}`)),
    [plannedCells],
  )

  const handleDateChange = async (next: string) => {
    setFromDate(next)
    await refreshTimetable(slots, next)
  }

  /** Jumps the calendar to the week the chosen event falls in, so its slots are on screen. */
  const handleEventChange = async (nextEventId: string) => {
    setSpace({ layout: '', attendance: 0 })
    setEventId(nextEventId)
    setHoldError(null)
    setHeldBookingId(null)
    // A verdict belongs to one event and one space; keeping it across a change would let the
    // coordinator answer an alert about the venue they were looking at a moment ago.
    setPendingAssessment(null)
    const event = events.find((candidate) => candidate.id === nextEventId)
    if (event?.proposedStart && event.proposedEnd && venue) {
      try {
        const cells = occupiedVenueCells(new Date(event.proposedStart), new Date(event.proposedEnd), venue)
        await handleDateChange(cells[0].date)
      } catch {
        // The preview reports invalid timing; do not navigate to an invalid date.
      }
    }
  }

  /**
   * Places the hold. Reached either straight from the button, when nothing in the assessment
   * stands in the way, or from "Book anyway" if a reason is ever made overridable. Kept separate
   * from the check so that answering the alert does not run the assessment a second time.
   */
  const placeHold = async () => {
    setHolding(true)
    setHoldError(null)
    setPendingAssessment(null)
    const result = await holdVenue(eventId, venueId, undefined, space)
    if (result.ok) {
      setHeldBookingId(result.bookingId)
      await refreshTimetable(slots, fromDate)
    } else {
      setHoldError(result.reason)
    }
    setHolding(false)
  }

  /**
   * AC-011.10: the venue's suitability is checked before a hold is placed, and the coordinator
   * sees the reasons rather than a bare refusal after the fact.
   *
   * The assessment is US18's, written for venue search, where it judges one venue against the
   * whole event. A booking is narrower than its event, so two of its reason codes do not carry
   * over unchanged — see the two lists below. A check that cannot run fails open: suitability is
   * advice, the database is the control, and refusing to attempt a hold because an advisory read
   * broke would deny a venue the database would have accepted.
   */
  const handleHold = async () => {
    setChecking(true)
    setHoldError(null)
    try {
      const assessment = await assessVenueForBooking(eventId, venueId, slots)
      if (assessment.ok) {
        const gate = gateFor(assessment.value)
        if (gate) {
          setPendingAssessment(gate)
          return
        }
      }
    } catch {
      // Fail open, as above.
    } finally {
      setChecking(false)
    }
    await placeHold()
  }

  const eventIsBookable = canBookForEventStatus(selectedEvent ? 'approved' : null)
  const canHold = Boolean(eventId) && plannedCells.length > 0 && !heldBookingId && eventIsBookable && !spaceError(space)

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
        <Link to="/venues/search" className="hover:text-slate-900 hover:underline">Venues</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <Link to={`/venues/${venueId}`} className="hover:text-slate-900 hover:underline">
          {venue?.name ?? 'Venue'}
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span className="text-slate-700">Timetable</span>
      </nav>

      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {venue ? `${venue.name} availability` : 'Venue availability'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Choose one of your events to see the slots its booking would take, including the
          venue's configured setup and turnaround time.
        </p>
      </div>

      {userLoading ? (
        <p className="text-sm text-slate-500">Checking your session…</p>
      ) : !isCoordinator ? (
        <Card title="Not available for your role">
          <p className="text-sm text-slate-600">Venue booking is available to event coordinators.</p>
        </Card>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading availability…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="timetable-event" label="Book for one of your events">
              <select
                id="timetable-event"
                className={selectClassName}
                value={eventId}
                disabled={busy}
                onChange={(e) => handleEventChange(e.target.value)}
              >
                <option value="">— No event selected —</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.reference ?? event.name ?? event.id}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="timetable-from" label="Week beginning">
              <input
                id="timetable-from"
                type="date"
                className={selectClassName}
                value={fromDate}
                disabled={busy}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </Field>
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          ) : timetable ? (
            <Card title="Availability">
              <VenueTimetableGrid timetable={timetable} selectedKeys={selectedKeys} />
            </Card>
          ) : null}

          {selectedEvent && (
            <Card
              title="Booking time summary"
              description="Event timing and the venue occupancy required for this booking."
            >
              {preview.error ? <p role="alert" className="text-sm text-red-700">{preview.error}</p> : (
                venue && selectedEvent.proposedStart && selectedEvent.proposedEnd && <BookingTimeSummary
                  start={selectedEvent.proposedStart} end={selectedEvent.proposedEnd}
                  setupMinutes={venue.setupMinutes} turnaroundMinutes={venue.turnaroundMinutes}
                  cells={plannedCells}
                />
              )}

              {holdError && (
                <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {holdError}
                </div>
              )}

              <BookingSpaceFields
                key={`${venueId}-${eventId}`}
                venueId={venueId}
                value={space}
                // Layout and attendance are two of the things suitability is judged on, so a
                // change to either makes an open verdict stale: drop it and check again.
                onChange={(next) => { setSpace(next); setPendingAssessment(null) }}
                disabled={busy || Boolean(heldBookingId)}
              />

              {pendingAssessment ? (
                <div className="mt-4">
                  <UnsuitableVenueAlert
                    assessment={pendingAssessment}
                    onProceed={placeHold}
                    onCancel={() => setPendingAssessment(null)}
                  />
                </div>
              ) : heldBookingId ? (
                <div role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  Tentative hold placed. It expires in 3 days if it is not submitted.{' '}
                  <Link to="/venues/bookings" className="font-medium underline">
                    View your venue bookings
                  </Link>
                </div>
              ) : (
                <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                  <Button type="button" onClick={handleHold} disabled={!canHold || busy}>
                    {checking ? 'Checking the venue…' : holding ? 'Placing hold…' : 'Place tentative hold'}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {!selectedEvent && (
            <p className="text-sm text-slate-500">
              {VENUE_BOOKING_MESSAGES.noEventTimes.replace('The event needs', 'Pick an event. Each event needs')}
            </p>
          )}
        </div>
      )}
    </PageContainer>
  )
}