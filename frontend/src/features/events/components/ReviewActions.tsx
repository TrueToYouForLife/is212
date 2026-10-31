import { useState } from 'react'
import { FEATURES } from '../../../lib/features'
import { transitionEventStatus } from '../eventReviewService'
import { reviewActionsFor, STATUS_TRANSITIONS } from '../statusRules'
import type { EventStatus } from '../types'

interface ReviewActionsProps {
  eventId: string
  status: EventStatus
  /** The event's end, so Mark completed appears only after it has passed (AC-038.6). */
  endsAt?: string | null
  onReviewed: (status: EventStatus) => void
}

const TONE_CLASSES = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  neutral: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
} as const

/**
 * Offers only the moves the workflow actually allows, from the same pure rules the service
 * and the database trigger enforce. A button that produces an error on click is a worse
 * experience than a button that is not there.
 */
export function ReviewActions({ eventId, status, endsAt, onReviewed }: ReviewActionsProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const actions = reviewActionsFor(status, endsAt)
  if (actions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {STATUS_TRANSITIONS[status].length === 0
          ? 'This request is in a final state and cannot be changed.'
          : 'No coordinator actions are available at this stage.'}
      </p>
    )
  }

  const act = async (to: EventStatus) => {
    if (to === 'cancelled' && !window.confirm('Cancel this event? This cannot be undone.')) return
    setBusy(true)
    setError(null)

    try {
      const result = await transitionEventStatus({
        id: eventId,
        from: status,
        to,
        actor: { role: 'coordinator', isOwner: false },
        note,
      })

      if (result.ok) {
        setNote('')
        onReviewed(result.status)
      } else {
        setError(result.reason)
      }
    } catch {
      setError('The event could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {status === 'planning' && (
        <p className="text-sm text-slate-600">
          {FEATURES.safetyReview
            ? 'Send this event for safety review from its Readiness card once every arrangement is complete.'
            : 'Confirm only after you have checked that all essential event arrangements are complete.'}
        </p>
      )}
      {status === 'in_preparation' && (
        <p className="text-sm text-slate-600">
          Confirm only after you have checked that all essential event arrangements are complete.
        </p>
      )}
      {status === 'confirmed' && (
        <p className="text-sm text-slate-600">Mark completed only after the event has taken place.</p>
      )}
      <div>
        <label htmlFor="review-note" className="block text-sm font-medium text-slate-700">
          Note to the organiser
        </label>
        <textarea
          id="review-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Required when rejecting or returning a request."
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
            shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2
            focus:ring-indigo-500/30"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action.to}
            type="button"
            disabled={busy}
            onClick={() => void act(action.to)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition
              disabled:cursor-not-allowed disabled:opacity-60 ${TONE_CLASSES[action.tone]}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
