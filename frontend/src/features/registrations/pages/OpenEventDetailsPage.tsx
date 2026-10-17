import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatDateTime } from '../../events/formatters'
import { RegisterOrWaitlist } from '../components/RegisterOrWaitlist'
import { loadOpenEvent } from '../registrationService'
import type { LoadResult, OpenEventDetails } from '../types'

const backLink = (
  <Link to="/events/open" className="text-sm font-medium text-indigo-700 hover:underline">
    ← Events open for registration
  </Link>
)

/**
 * US15 AC-015.1: one open event's public details and, unless already registered, the form.
 * Loaded once rather than polled, so a refresh can never reset answers being typed.
 */
export function OpenEventDetailsPage() {
  const { id = '' } = useParams()
  const { session, loading } = useCurrentUser()
  const [result, setResult] = useState<LoadResult<OpenEventDetails> | null>(null)
  // US16: bumped after a waiting-list change so the page shows the Attendee's new state.
  const [reloads, setReloads] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let active = true
    void loadOpenEvent(id).then((loaded) => { if (active) setResult(loaded) })
    return () => { active = false }
  }, [id, session, reloads])

  if (loading) return <PageContainer><p className="text-sm text-slate-500">Loading…</p></PageContainer>
  if (!session) return <Navigate to="/signin" replace state={{ from: `/events/open/${id}` }} />
  if (!result) return <PageContainer><p className="text-sm text-slate-500">Loading event…</p></PageContainer>

  if (!result.ok) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{result.reason}</p>
          {backLink}
        </div>
      </PageContainer>
    )
  }

  const event = result.value
  // Blank prerequisites count as none, as in register_for_event, so the form and the
  // database agree on whether the confirmation is required.
  const prerequisites = event.prerequisites?.trim() || null
  return (
    <PageContainer>
      <div className="space-y-6">
        {backLink}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{event.name}</h1>
          {event.eventType && <p className="mt-1 text-sm text-slate-500">{event.eventType}</p>}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">When (Singapore time)</dt>
            <dd className="text-slate-900">
              {formatDateTime(event.start)}{event.end ? ` – ${formatDateTime(event.end)}` : ''}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Where</dt>
            <dd className="text-slate-900">{event.venue ?? 'Venue to be confirmed'}</dd>
          </div>
        </dl>

        {event.description && <p className="whitespace-pre-line text-sm text-slate-700">{event.description}</p>}
        {event.programme && (
          <Card title="Programme">
            <p className="whitespace-pre-line text-sm text-slate-700">{event.programme}</p>
          </Card>
        )}

        <Card title="Prerequisites">
          <p className="whitespace-pre-line text-sm text-slate-700">
            {prerequisites ?? 'No prerequisites for this event.'}
          </p>
        </Card>

        <Card title="Register">
          {notice && <p role="alert" className="mb-3 text-sm text-red-700">{notice}</p>}
          <RegisterOrWaitlist event={event} hasPrerequisites={prerequisites !== null}
            onChanged={() => setReloads((count) => count + 1)} onNotice={setNotice} />
        </Card>
      </div>
    </PageContainer>
  )
}
