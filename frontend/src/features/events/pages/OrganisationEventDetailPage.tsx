import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { useCurrentUser } from '../../auth/sessionContext'
import { StatusBadge } from '../components/StatusBadge'
import { formatDateTime, orDash } from '../formatters'
import { ORGANISATION_EVENT_MESSAGES, loadOrganisationEvent } from '../organisationEventService'
import type { LoadResult, OrganisationEventDetail } from '../organisationEventService'
import { RegistrationsCard } from '../components/RegistrationsCard'

/**
 * US31 AC-031.2: one of the organisation's events, for a colleague who does not own it.
 *
 * Deliberately separate from /requests/:id. That page reads through the owner-scoped
 * service and carries the review actions, change-request forms and decision history — the
 * things a colleague must not have. Rather than teach it to hide half of itself for a
 * second audience, this is a read-only page over the projection in 0078, which can only
 * return the fields the team agreed to share.
 *
 * It is also where AC-054.4 becomes reachable: the registrations a colleague is allowed to
 * see had no route into them until this page existed.
 */
export function OrganisationEventDetailPage() {
  const { id } = useParams()
  const { session, profile, loading } = useCurrentUser()

  return <PageContainer>
    <Link to="/organisation/events"
      className="mb-4 inline-block text-sm text-indigo-700 hover:underline">
      &larr; Back to our organisation&rsquo;s events
    </Link>
    {loading ? <p role="status">Checking your session&hellip;</p>
      : !session ? <p>Sign in to see your organisation&rsquo;s events.</p>
      : profile?.role !== 'organiser'
        ? <p>Organisation events are available to event organisers only.</p>
      : !id ? <p role="alert">{ORGANISATION_EVENT_MESSAGES.notFound}</p>
      : <EventDetail key={id} eventId={id} />}
  </PageContainer>
}

function EventDetail({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<LoadResult<OrganisationEventDetail> | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadOrganisationEvent(eventId)
      .then((response) => { if (active) setResult(response) })
      .catch(() => {
        if (active) setResult({ ok: false, reason: ORGANISATION_EVENT_MESSAGES.loadFailed })
      })
    return () => { active = false }
  }, [eventId, attempt])

  if (!result) return <p role="status">Loading event&hellip;</p>

  if (!result.ok) {
    // "Not found" covers another organisation's event, a draft and an id that is nothing
    // at all — 0078 does not distinguish them, so retrying cannot help. Only a failed read
    // is worth another go.
    const missing = result.reason === ORGANISATION_EVENT_MESSAGES.notFound
    return <div>
      <p role="alert" className="mb-3">{result.reason}</p>
      {!missing && (
        <Button onClick={() => { setResult(null); setAttempt(attempt + 1) }}>Try again</Button>
      )}
    </div>
  }

  const event = result.value

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {event.name?.trim() || event.reference || 'Untitled request'}
        </h1>
        <p className="mt-1 text-slate-600">
          {event.isMine ? 'Yours' : event.organiserName}
          {event.reference ? ` · ${event.reference}` : ''}
        </p>
      </div>
      {/* A colleague is an Organiser, so they read the organiser wording. 0078 withholds
          the review note, so this can never say "Clarification required". */}
      <StatusBadge status={event.status} organiserView />
    </div>

    <Card title="Event details">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Detail label="Purpose" value={event.purpose} />
        <Detail label="Event type" value={event.eventType} />
        <Detail label="Starts" value={formatDateTime(event.proposedStart)} />
        <Detail label="Ends" value={formatDateTime(event.proposedEnd)} />
        <Detail label="Expected attendance" value={event.expectedAttendance} />
      </dl>
    </Card>

    {/* US54 AC-054.4. 0094 decides whether this colleague may actually read the list; the
        link is a courtesy, and the page it opens reports a refusal plainly if not. */}
    <RegistrationsCard eventId={event.id} isOwner={event.isMine} />

    {event.isMine && (
      <Card title="Your request">
        <Link to={`/requests/${event.id}`}
          className="text-sm font-medium text-indigo-700 hover:underline">
          Open the full request
        </Link>
      </Card>
    )}
  </div>
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return <div>
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="text-slate-900">{orDash(value)}</dd>
  </div>
}
