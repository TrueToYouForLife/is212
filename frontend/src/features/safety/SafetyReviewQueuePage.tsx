import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { PageContainer } from '../../components/layout/PageContainer'
import { formatDateTime, orDash } from '../events/formatters'
import { getSafetyReviewQueue } from './safetyReviewQueueService'
import type { QueueEquipment, QueueEvent, QueueVenue } from './safetyReviewQueueService'

/** "45 of 40": the space's attendance against the venue's capacity for that layout. */
function attendanceAgainstCapacity(venue: QueueVenue) {
  const over = venue.attendance !== null && venue.capacity !== null && venue.attendance > venue.capacity
  return (
    <span className={over ? 'font-semibold text-red-700' : undefined}>
      {orDash(venue.attendance)} of {orDash(venue.capacity)}
      {over && ' (over capacity)'}
    </span>
  )
}

function equipmentLine(item: QueueEquipment) {
  return `${item.item} × ${item.quantity}${item.essential ? ' (essential)' : ''}: ${item.reserved} of ${item.quantity} reserved`
}

function QueueEventCard({ event }: { event: QueueEvent }) {
  const title = event.reference ? `${event.reference} · ${event.name}` : event.name
  return (
    <li>
      <Card title={title} description={`Sent for review ${formatDateTime(event.sentAt)}`}>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-700">When</dt>
            <dd>{formatDateTime(event.proposedStart)} to {formatDateTime(event.proposedEnd)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Expected attendance</dt>
            <dd>{orDash(event.expectedAttendance)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium text-slate-700">Accessibility requirements</dt>
            <dd>{event.accessibility.length ? event.accessibility.join(', ') : 'None recorded'}</dd>
          </div>
        </dl>

        <h3 className="mt-4 text-sm font-semibold text-slate-800">Venues</h3>
        {event.venues.length === 0 ? (
          <p className="text-sm text-slate-600">No approved venue bookings.</p>
        ) : (
          <ul aria-label={`Venues for ${title}`} className="mt-1 space-y-2 text-sm">
            {event.venues.map((venue) => (
              <li key={`${venue.venue}-${venue.layout}`} className="rounded border border-slate-200 p-2">
                <p className="font-medium">{venue.venue}{venue.location ? `, ${venue.location}` : ''}</p>
                <p>{orDash(venue.layout)} layout: {attendanceAgainstCapacity(venue)}</p>
                <p>Accessibility: {venue.accessibility.length ? venue.accessibility.join(', ') : 'None recorded'}</p>
                <p>Restrictions: {venue.restrictions.length ? venue.restrictions.join('; ') : 'None recorded'}</p>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-4 text-sm font-semibold text-slate-800">Equipment</h3>
        {event.equipment.length === 0 ? (
          <p className="text-sm text-slate-600">No equipment requested.</p>
        ) : (
          <ul aria-label={`Equipment for ${title}`} className="mt-1 list-disc pl-5 text-sm">
            {event.equipment.map((item) => <li key={item.item}>{equipmentLine(item)}</li>)}
          </ul>
        )}
      </Card>
    </li>
  )
}

/**
 * US43 AC-043.4: the events awaiting the Safety Officer's review, oldest first, with what the
 * Operational Safety Check needs. Read-only; the decision itself is US44.
 */
export function SafetyReviewQueuePage() {
  const [events, setEvents] = useState<QueueEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getSafetyReviewQueue().then((result) => {
      if (cancelled) return
      if (result.ok) setEvents(result.events)
      else setError(result.reason)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold text-slate-900">Safety reviews</h1>
      <p className="mt-1 text-sm text-slate-600">Events awaiting their Operational Safety Check, the longest waiting first.</p>
      <div className="mt-6">
        {error ? (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        ) : !events ? (
          <p className="text-sm text-slate-500">Loading events awaiting review…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-600">No events are awaiting safety review.</p>
        ) : (
          <ol aria-label="Events awaiting safety review" className="space-y-4">
            {events.map((event) => <QueueEventCard key={event.eventId} event={event} />)}
          </ol>
        )}
      </div>
    </PageContainer>
  )
}
