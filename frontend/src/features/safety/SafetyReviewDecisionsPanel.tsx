import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { formatDateTime } from '../events/formatters'
import { DECISION_LABELS, factorLabel } from './safetyDecision'
import { getSafetyReviewDecisions } from './safetyDecisionService'
import type { SafetyReviewDecision } from './safetyDecisionService'

function DecisionDetails({ decision }: { decision: SafetyReviewDecision }) {
  const concerns = decision.assessments.filter((assessment) => assessment.concern)
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-slate-900">
        {DECISION_LABELS[decision.decision]} by {decision.decidedByName ?? 'the Safety Officer'} on {formatDateTime(decision.decidedAt)}
      </p>
      {decision.revisit.length > 0 && <p>Revisit: {decision.revisit.join(' and ')}</p>}
      {decision.comment && <p>Comment: {decision.comment}</p>}
      {concerns.length > 0 && (
        <ul aria-label="Concerns" className="list-disc pl-5">
          {concerns.map((concern) => <li key={concern.factor}>{factorLabel(concern.factor)}: {concern.note}</li>)}
        </ul>
      )}
    </div>
  )
}

/**
 * US44 AC-044.5: the event's safety review decisions for its Coordinator, newest first. Shows
 * nothing until the Safety Officer has decided.
 */
export function SafetyReviewDecisionsPanel({ eventId, refreshVersion = 0 }: { eventId: string; refreshVersion?: number }) {
  const [decisions, setDecisions] = useState<SafetyReviewDecision[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getSafetyReviewDecisions(eventId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setDecisions(result.decisions)
        setError(null)
      } else {
        setError(result.reason)
      }
    })
    return () => {
      cancelled = true
    }
  }, [eventId, refreshVersion])

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>
  if (!decisions || decisions.length === 0) return null
  const [latest, ...earlier] = decisions
  return (
    <Card title="Safety review">
      <DecisionDetails decision={latest} />
      {earlier.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">Earlier decisions ({earlier.length})</summary>
          <ol className="mt-2 space-y-3">
            {earlier.map((decision) => <li key={decision.decisionId}><DecisionDetails decision={decision} /></li>)}
          </ol>
        </details>
      )}
    </Card>
  )
}
