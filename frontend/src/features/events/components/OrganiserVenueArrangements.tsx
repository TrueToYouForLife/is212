import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import { loadOrganiserVenueArrangements } from '../organiserVenueArrangementService'
import { useRequestResource } from '../status/useRequestResource'

const bookedDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', dateStyle: 'medium' })

export function OrganiserVenueArrangements({ eventId, refreshVersion = 0 }: {
  eventId: string; refreshVersion?: number
}) {
  const read = useCallback(() => loadOrganiserVenueArrangements(eventId), [eventId])
  const { value, loading, error, refresh } = useRequestResource(`${eventId}:${refreshVersion}`, read)

  return <Card title="Venue arrangements" description="Approved venue bookings. All dates and times are in Singapore time.">
    <button type="button" onClick={refresh} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">
      Refresh venue arrangements
    </button>
    {loading ? <p role="status" className="text-sm text-slate-500">Loading venue arrangements…</p>
      : error ? <div role="alert" className="text-sm text-red-700">
        {error} <button type="button" onClick={refresh} className="underline">Try again</button>
      </div>
        : value?.length === 0 ? <p className="text-sm text-slate-500">No venue bookings have been approved yet.</p>
          : <div className="space-y-4">{value?.map(booking => (
            <article key={booking.booking_id} aria-label={booking.venue_name} className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900">{booking.venue_name}</h3>
              {booking.slots.length === 0 ? <p className="mt-2 text-sm text-slate-600">
                Booked slot details are unavailable. Contact your coordinator.
              </p> : <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {booking.slots.map(slot => <li key={`${slot.date}:${slot.slot}`}>
                  <time dateTime={slot.date}>{bookedDate.format(new Date(`${slot.date}T00:00:00+08:00`))}</time>
                  {' · '}{slot.slot}{' · '}{slot.startsAt.slice(0, 5)}–{slot.endsAt.slice(0, 5)}
                  {slot.endsAt === '24:00:00' && ' (midnight at end of day)'}
                  {' · '}{slot.kind === 'event' ? 'Event' : 'Setup / turnaround'}
                </li>)}
              </ul>}
            </article>
          ))}</div>}
  </Card>
}
