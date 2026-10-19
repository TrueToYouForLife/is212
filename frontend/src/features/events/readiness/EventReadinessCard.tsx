import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { STATUS_REFRESH_MS } from '../status/useRequestResource'
import { ReadinessSummary } from './ReadinessSummary'
import { getEventReadiness } from './readinessService'
import type { ReadinessLine } from './types'

/**
 * US5: the readiness summary on the event's page, for its assigned Coordinator. Re-read when
 * the page refreshes after a change here, and on the same 30-second cycle as the status, so a
 * change made by Venue Staff or Technical Support shows without reloading (AC-005.7).
 */
export function EventReadinessCard({ eventId, refreshVersion = 0 }: { eventId: string; refreshVersion?: number }) {
  const [lines, setLines] = useState<ReadinessLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void getEventReadiness(eventId).then((result) => {
        if (cancelled) return
        if (result.ok) {
          setLines(result.lines)
          setError(null)
        } else {
          setError(result.reason)
        }
      })
    }
    load()
    const timer = window.setInterval(load, STATUS_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [eventId, refreshVersion])

  return (
    <Card title="Readiness" description="Which of this event's arrangements are complete, and which are still outstanding.">
      {error ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : !lines ? (
        <p className="text-sm text-slate-500">Checking arrangements…</p>
      ) : (
        <ReadinessSummary eventId={eventId} lines={lines} />
      )}
    </Card>
  )
}
