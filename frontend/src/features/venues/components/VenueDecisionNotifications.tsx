import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { listVenueDecisionNotifications } from '../venueDecisionNotificationService'
import type { VenueDecisionNotification } from '../venueDecisionNotificationService'

export function VenueDecisionNotifications() {
  const { profile, loading: sessionLoading } = useCurrentUser()
  const coordinator = profile?.role === 'coordinator'
  const [items, setItems] = useState<VenueDecisionNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setItems([]); setError(null)
    const result = await listVenueDecisionNotifications()
    if (request !== sequence.current) return
    if (result.ok) setItems(result.notifications)
    else setError(result.reason)
    setLoading(false)
  }, [])
  useEffect(() => {
    if (!sessionLoading && coordinator) void load()
    return () => { sequence.current += 1 }
  }, [sessionLoading, coordinator, profile?.id, load])
  if (sessionLoading || !coordinator) return null
  return <Card title="Booking decision notifications">
    <p className="mb-3 text-sm text-slate-600">Latest 50 decisions. Refresh to check for new notifications.</p>
    {loading ? <p>Loading notifications…</p> : error ? <p role="alert">{error}</p> : items.length === 0 ?
      <p>No booking decision notifications yet.</p> : <ul className="space-y-4">
        {items.map((item) => <li key={item.id} className="rounded border p-3">
          <p className="font-semibold">{item.decision === 'confirmed' ? 'Booking approved' : 'Booking rejected'} — {item.venue_name}</p>
          <p>{item.event_reference ?? 'Event reference unavailable'}</p>
          {item.reason && <p>Reason: {item.reason}</p>}
          {item.alternative && <p>Suggested alternative: {item.alternative}</p>}
          <p className="text-sm text-slate-500">{formatDateTime(item.reviewed_at)}</p>
        </li>)}
      </ul>}
    <Button type="button" disabled={loading} onClick={() => void load()}>Refresh notifications</Button>
  </Card>
}
