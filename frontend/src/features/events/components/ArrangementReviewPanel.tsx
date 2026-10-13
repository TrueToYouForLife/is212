import { useCallback, useEffect } from 'react'
import { ArrangementResolutionForm } from './ArrangementResolutionForm'
import { Card } from '../../../components/ui/Card'
import { listArrangementReviews } from '../arrangementReviewService'
import type { ArrangementReviewFlag } from '../arrangementReviewService'
import { formatDateTime } from '../formatters'
import { useRequestResource } from '../status/useRequestResource'

export function ArrangementReviewPanel({ eventId, refreshVersion = 0, onCount }: { eventId: string; refreshVersion?: number; onCount?: (count: number | null) => void }) {
  const read = useCallback(() => listArrangementReviews(eventId), [eventId])
  const { value, loading, error, refresh } = useRequestResource(`${eventId}:${refreshVersion}`, read)
  const groups = new Map<string, ArrangementReviewFlag[]>()
  for (const flag of (value ?? []).filter(flag => flag.status === 'open')) {
    const key = flag.venue_booking_id ? `venue:${flag.venue_booking_id}` : `equipment:${flag.equipment_booking_id}`
    groups.set(key, [...(groups.get(key) ?? []), flag])
  }
  const resolved = (value ?? []).filter(flag => flag.status === 'resolved')
    .sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''))
  const count = loading || error ? null : groups.size
  useEffect(() => { onCount?.(count) }, [onCount, count])
  return <div id="arrangement-reviews" className="scroll-mt-6"><Card title="Arrangement reviews" description="Bookings and reservations needing review after approved changes. Existing reservations remain unchanged.">
    <button type="button" onClick={refresh} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh arrangement reviews</button>
    {loading ? <p role="status">Loading arrangement reviews…</p> : error ?
      <p role="alert" className="text-sm text-red-700">{error}</p> : groups.size === 0 ?
        <p className="text-sm text-slate-500">No arrangements are currently flagged for review.</p> :
        <div className="space-y-4">{Array.from(groups, ([key, flags]) => {
          const first = flags[0]
          const isVenue = first.venue_booking_id !== null
          const title = isVenue ? `Venue booking${first.venue_booking?.venue?.name ? ` — ${first.venue_booking.venue.name}` : ''}` : 'Equipment reservation'
          return <article key={key} aria-label={title} className="rounded-lg border border-amber-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">Needs review</span>
            </div>
            <p className="mt-2 break-all text-xs text-slate-500">Reference: {first.venue_booking_id ?? first.equipment_booking_id}</p>
            <ul className="mt-3 space-y-3">{flags.map(flag => <li key={flag.id}>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{flag.detail}</p>
              <p className="mt-1 text-xs text-slate-500">Flagged {formatDateTime(flag.created_at)} (Singapore time)</p>
              <ArrangementResolutionForm flagId={flag.id} onResolved={refresh} />
            </li>)}</ul>
          </article>
        })}</div>}
    {!loading && !error && resolved.length > 0 && <section aria-label="Resolution history" className="mt-6 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-900">Resolution history</h3>
      <ul className="mt-3 space-y-4">{resolved.map(flag => <li key={flag.id} className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">{flag.venue_booking_id ? 'Venue booking' : 'Equipment reservation'} — {flag.venue_booking?.venue?.name ?? flag.venue_booking_id ?? flag.equipment_booking_id}</p>
        <p className="break-all text-xs text-slate-500">Reference: {flag.venue_booking_id ?? flag.equipment_booking_id}</p>
        <p className="mt-2 whitespace-pre-wrap">{flag.detail}</p>
        <p className="mt-2 font-medium text-green-800">Resolved — {flag.resolution_method === 'corrected' ? 'Arrangement corrected' : 'Still valid'}</p>
        <p className="whitespace-pre-wrap break-words">{flag.resolution}</p>
        <p className="mt-1 text-xs text-slate-500">Recorded by {flag.resolver?.full_name || flag.resolved_by} · {formatDateTime(flag.resolved_at)} (Singapore time)</p>
      </li>)}</ul>
    </section>}
  </Card></div>
}
