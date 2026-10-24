import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { STATUS_REFRESH_MS } from '../status/useRequestResource'
import { ReadinessSummary } from './ReadinessSummary'
import { getEventReadiness, sendForSafetyReview } from './readinessService'
import { readyForSafetyReview } from './safetyReviewReadiness'
import type { EventStatus } from '../types'
import type { ReadinessLine } from './types'

/**
 * US5: the readiness summary on the event's page, for its assigned Coordinator. Re-read when
 * the page refreshes after a change here, and on the same 30-second cycle as the status, so a
 * change made by Venue Staff or Technical Support shows without reloading (AC-005.7).
 * US43: in Planning it also offers "Send for safety review", once every arrangement is complete.
 */
export function EventReadinessCard({ eventId, refreshVersion = 0, status, onSent }: {
  eventId: string
  refreshVersion?: number
  status?: EventStatus
  onSent?: () => void
}) {
  const [lines, setLines] = useState<ReadinessLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function send() {
    setSending(true)
    setSendError(null)
    const result = await sendForSafetyReview(eventId)
    setSending(false)
    if (result.ok) onSent?.()
    else setSendError(result.reason)
  }

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
        <>
          <ReadinessSummary eventId={eventId} lines={lines} />
          {status === 'planning' && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              {readyForSafetyReview(lines) ? (
                <Button type="button" onClick={() => void send()} disabled={sending}>
                  {sending ? 'Sending…' : 'Send for safety review'}
                </Button>
              ) : (
                <p className="text-sm text-slate-600">
                  Send for safety review becomes available once every arrangement above is complete.
                </p>
              )}
              {sendError && <p role="alert" className="mt-2 text-sm text-red-700">{sendError}</p>}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
