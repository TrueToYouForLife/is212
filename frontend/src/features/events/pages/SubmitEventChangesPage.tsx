import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { USER_ROLE_LABELS } from '../../auth/types'
import type { UserProfile } from '../../auth/types'
import { EventChangeRequestForm } from '../components/EventChangeRequestForm'
import { RequestDetails } from '../components/RequestDetails'
import { useRequestResource } from '../status/useRequestResource'
import { getEventRequest } from '../eventReviewService'
import { LOCKED_STATUSES } from '../eventChangeRequestService'
import { useCallback } from 'react'

export function SubmitEventChangesPage() {
  const { id = '' } = useParams()
  const { session, profile, loading: userLoading } = useCurrentUser()

  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: null }
    const result = await getEventRequest(id)
    return result.ok ? { ok: true as const, value: result.request } : result
  }, [id, userLoading])

  const { value: event, error, loading } = useRequestResource(`${id}:${profile?.id}`, read)

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
        <Link to={`/requests/${id}`} className="hover:text-slate-900 hover:underline">
          Request
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span className="text-slate-700">Request changes</span>
      </nav>

      <div className="mb-8 max-w-3xl">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Request changes to your event
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your original submission stays in force until a coordinator reviews and approves
          these changes.
        </p>
      </div>

      {loading || userLoading ? (
        <p className="text-sm text-slate-500">Loading event details…</p>
      ) : error || !event ? (
        <Card title="Request unavailable">
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      ) : !session ? (
        <SignedOutNotice />
      ) : !profile ? (
        <Card title="No organiser profile">
          <p className="text-sm text-slate-600">
            You are signed in, but your account has no usable profile, so there is nothing to
            file a request against. Ask an administrator to check your profile and role.
          </p>
        </Card>
      ) : profile.role !== 'organiser' ? (
        <WrongRoleNotice profile={profile} />
      ) : event.organiserId !== profile?.id ? (
        <Card title="Not available">
          <p className="text-sm text-slate-600">This event does not belong to your account.</p>
        </Card>
      ) : LOCKED_STATUSES.includes(event.status) ? (
        <Card title="Changes not available">
          <p className="text-sm text-slate-600">
            This event is {event.status} and can no longer be changed.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Current event details">
            <RequestDetails request={event} />
          </Card>

          <Card
            title="Proposed changes"
            description="Only fill in the fields you want to change. Anything left blank stays as it is above."
          >
            <EventChangeRequestForm eventId={id} />
          </Card>
        </>
      )}
    </PageContainer>
  )
}

function SignedOutNotice() {
  return (
    <Card title="Sign in to continue">
      <p className="text-sm text-slate-600">
        You need to be signed in as an event organiser to submit a request.
      </p>
      <Link
        to="/signin"
        state={{ from: '/events/new' }}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5
          py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        Sign in
      </Link>
    </Card>
  )
}

function WrongRoleNotice({ profile }: { profile: UserProfile }) {
  return (
    <Card title="Not available for your role">
      <p className="text-sm text-slate-600">
        You are signed in as <strong>{USER_ROLE_LABELS[profile.role]}</strong>. Event requests
        are submitted by the organiser running the event.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        If you need to raise one yourself, ask your coordinator to set you up as an organiser.
      </p>
    </Card>
  )
}