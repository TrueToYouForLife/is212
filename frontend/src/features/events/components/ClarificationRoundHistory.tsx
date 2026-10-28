import { useEffect, useState } from 'react'
import { clarificationChanges } from '../clarificationDisplay'
import { loadClarificationRounds } from '../clarificationResponseService'
import { formatDateTime } from '../formatters'
import type { ClarificationRound } from '../clarificationResponseService'

/**
 * US37 AC-037.5 (SCRUM-234): every round already answered, newest first.
 *
 * Shared by the Organiser and the assigned Coordinator — 0096's policy admits both, and
 * there is nothing internal in the record to withhold from either. The Coordinator reads it
 * to see what they were told; the Organiser reads it to see what they have already said.
 *
 * Each round shows the question as it stood at the time rather than the event's current
 * note, which is the reason 0096 copies it into the record: by the time a second round is
 * answered, the first question is no longer anywhere on the event.
 */
export function ClarificationRoundHistory({ eventId, refreshVersion }: {
  eventId: string
  refreshVersion?: number
}) {
  const [rounds, setRounds] = useState<ClarificationRound[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadClarificationRounds(eventId).then((result) => {
      if (!active) return
      if (result.ok) { setRounds(result.value); setError(null) }
      // An empty list would read as "you have never replied", which is a different and
      // more alarming claim than "this could not be loaded".
      else { setRounds(null); setError(result.reason) }
    })
    return () => { active = false }
  }, [eventId, refreshVersion])

  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>
  if (!rounds) return <p role="status" className="text-sm text-slate-500">Loading replies…</p>
  if (rounds.length === 0) {
    return <p className="text-sm text-slate-600">No clarification has been answered yet.</p>
  }

  return <ol className="space-y-4">
    {rounds.map((round) => {
      const changes = clarificationChanges(round.beforeValues, round.afterValues)
      return <li key={round.id} className="rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Reply {round.round}</p>
          <p className="text-xs text-slate-500">{formatDateTime(round.respondedAt)}</p>
        </div>

        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Asked</p>
        <p className="whitespace-pre-line text-sm text-slate-700">{round.reviewNote}</p>

        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Answered</p>
        <p className="whitespace-pre-line text-sm text-slate-900">{round.reply}</p>

        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Revised</p>
        {changes.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing was changed.</p>
        ) : (
          <dl className="space-y-1">
            {changes.map((change) => (
              <div key={change.column} className="text-sm">
                <dt className="text-slate-500">{change.label}</dt>
                <dd className="text-slate-900">
                  <span className="line-through decoration-slate-400">{change.before}</span>
                  <span aria-hidden="true" className="mx-2">&rarr;</span>
                  <span className="font-medium">{change.after}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </li>
    })}
  </ol>
}
