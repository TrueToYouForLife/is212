import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { useCurrentUser } from '../../auth/sessionContext'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime } from '../formatters'
import { ORGANISATION_EVENT_MESSAGES, loadOrganisationEvents } from '../organisationEventService'
import type { LoadResult, OrganisationEvent } from '../organisationEventService'

/**
 * US31 slice 2 (AC-031.1 to AC-031.3): everything this Organiser's client organisation is
 * running, theirs and their colleagues' alike.
 *
 * Read-only by construction. A colleague's row offers no link and no action because there
 * is nothing they may do with it — hiding the controls is the courtesy, and 0078 plus the
 * ownership-scoped policies are the control.
 */
export function OrganisationEventsPage() {
  return <PageContainer>
    <h1 className="mb-2 text-3xl font-bold text-slate-900">Our organisation&rsquo;s events</h1>
    <p className="mb-6 text-slate-600">
      Everything your organisation has submitted. You can open and act on your own requests;
      a colleague&rsquo;s are here so you stay informed, and are read-only.
    </p>
    <OrganisationAccess><OrganisationEventList /></OrganisationAccess>
  </PageContainer>
}

/** Do not call the projection until auth is ready; the database still decides what returns. */
function OrganisationAccess({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useCurrentUser()
  const location = useLocation()
  if (loading) return <p role="status">Checking your session&hellip;</p>
  if (!session) return (
    <p>Sign in to see your organisation&rsquo;s events. <Link className="text-indigo-700 underline"
      to="/signin" state={{ from: location.pathname }}>Sign in</Link></p>
  )
  if (profile?.role !== 'organiser') {
    return <p>Organisation events are available to event organisers only.</p>
  }
  // Switching accounts must discard the previous organisation's rows rather than reuse them.
  return <div key={session.userId}>{children}</div>
}

function OrganisationEventList() {
  const [result, setResult] = useState<LoadResult<OrganisationEvent[]> | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadOrganisationEvents()
      .then((response) => { if (active) setResult(response) })
      .catch(() => {
        if (active) setResult({ ok: false, reason: ORGANISATION_EVENT_MESSAGES.loadFailed })
      })
    return () => { active = false }
  }, [attempt])

  if (!result) return <p role="status">Loading events&hellip;</p>

  // A failed read and an empty organisation say different things, so they look different.
  // Showing "no events yet" after a failure would hide the problem behind a plausible page.
  if (!result.ok) return <div>
    <p role="alert" className="mb-3">{result.reason}</p>
    <Button onClick={() => { setResult(null); setAttempt(attempt + 1) }}>Try again</Button>
  </div>

  if (result.value.length === 0) {
    return <p>Nobody in your organisation has submitted an event request yet.</p>
  }

  return <ul className="divide-y rounded-xl border border-slate-200 bg-white">
    {result.value.map((event) => (
      <li key={event.id} className="p-5">
        <OrganisationEventRow event={event} />
      </li>
    ))}
  </ul>
}

function OrganisationEventRow({ event }: { event: OrganisationEvent }) {
  const title = event.name?.trim() || event.reference || 'Untitled request'

  return <div className="flex items-start justify-between gap-4">
    <span>
      {/* Only the owner gets a link: /requests/:id reads through the owner-scoped service,
          so a colleague following it would reach "not found" and learn nothing useful. The
          detail view for a colleague's event is a later increment. */}
      {event.isMine
        ? <Link to={`/requests/${event.id}`} className="block font-medium text-indigo-700 underline">
            {title}
          </Link>
        : <span className="block font-medium text-slate-900">{title}</span>}
      <span className="block text-sm text-slate-500">
        {event.isMine ? 'Yours' : event.organiserName}
        {event.reference ? ` · ${event.reference}` : ''}
      </span>
      <span className="block text-sm text-slate-500">
        {formatDateTime(event.proposedStart)}
      </span>
    </span>
    {/* organiserView: a colleague is an Organiser, so they read the organiser wording.
        0078 withholds the review note, so this can never read "Clarification required" —
        what the coordinator asked the owner to clarify stays between those two. */}
    <StatusBadge status={event.status} organiserView />
  </div>
}
