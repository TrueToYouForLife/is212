import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../formatters'
import {
  EVENT_REGISTRATIONS_MESSAGES,
  loadEventRegistrations,
} from '../eventRegistrationsService'
import type { EventRegistration, EventRegistrationList, LoadResult } from '../eventRegistrationsService'

/**
 * US54 (AC-054.1 to AC-054.4): who has registered for an event.
 *
 * No role check here beyond "signed in". Three different audiences may read this list —
 * the Organiser running the event, the Coordinator assigned to it and the Organiser's
 * colleagues — and reproducing that predicate in the browser would be a second copy to
 * keep in step with 0094. The service reports a refusal; this renders it.
 */
export function EventRegistrationsPage() {
  const { id } = useParams()
  const { session, loading } = useCurrentUser()

  return <PageContainer>
    <Link to={id ? `/requests/${id}` : '/requests'}
      className="mb-4 inline-block text-sm text-indigo-700 hover:underline">
      &larr; Back to the request
    </Link>
    <h1 className="mb-6 text-3xl font-bold text-slate-900">Registrations</h1>
    {loading ? <p role="status">Checking your session&hellip;</p>
      : !session ? <p>Sign in to see this event&rsquo;s registrations.</p>
      : !id ? <p role="alert">{EVENT_REGISTRATIONS_MESSAGES.notPermitted}</p>
      : <RegistrationList key={id} eventId={id} />}
  </PageContainer>
}

function RegistrationList({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<LoadResult<EventRegistrationList> | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadEventRegistrations(eventId)
      .then((response) => { if (active) setResult(response) })
      .catch(() => {
        if (active) setResult({ ok: false, reason: EVENT_REGISTRATIONS_MESSAGES.loadFailed })
      })
    return () => { active = false }
  }, [eventId, attempt])

  if (!result) return <p role="status">Loading registrations&hellip;</p>

  if (!result.ok) {
    // A refusal is final; a failed read is worth another go. Offering a retry on a refusal
    // would invite someone to keep trying at a door that will not open.
    const refused = result.reason === EVENT_REGISTRATIONS_MESSAGES.notPermitted
    return <div>
      <p role="alert" className="mb-3">{result.reason}</p>
      {!refused && (
        <Button onClick={() => { setResult(null); setAttempt(attempt + 1) }}>Try again</Button>
      )}
    </div>
  }

  const { registrations, activeCount } = result.value

  if (registrations.length === 0) {
    return <p>Nobody has registered for this event yet.</p>
  }

  return <div className="space-y-4">
    {/* AC-054.2: the count is of people actually coming, which is the number the Organiser
        is planning against. The withdrawn rows stay visible below it. */}
    <p className="text-sm text-slate-600">
      <span className="font-medium text-slate-900">{activeCount}</span>
      {activeCount === 1 ? ' active registration' : ' active registrations'}
      {registrations.length !== activeCount
        && ` · ${registrations.length - activeCount} withdrawn`}
    </p>

    <ul className="divide-y rounded-xl border border-slate-200 bg-white">
      {registrations.map((registration) => (
        <li key={registration.id} className="p-5">
          <RegistrationRow registration={registration} />
        </li>
      ))}
    </ul>
  </div>
}

function RegistrationRow({ registration }: { registration: EventRegistration }) {
  const withdrawn = registration.status === 'withdrawn'

  return <div className="flex items-start justify-between gap-4">
    <span className={withdrawn ? 'text-slate-500' : undefined}>
      <span className="block font-medium">{registration.attendeeName}</span>
      <span className="block text-sm">{registration.attendeeEmail}</span>
      <span className="block text-sm text-slate-500">
        Registered {formatDateTime(registration.registeredAt)}
        {withdrawn && registration.withdrawnAt
          && ` · withdrawn ${formatDateTime(registration.withdrawnAt)}`}
      </span>
    </span>
    {/* Marked, not hidden: AC-054.2 wants the Organiser to see that someone pulled out
        rather than wonder whether they ever signed up. */}
    {withdrawn && (
      <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        Withdrawn
      </span>
    )}
  </div>
}
