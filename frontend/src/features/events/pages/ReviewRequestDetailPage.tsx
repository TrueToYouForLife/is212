import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestDetails } from '../components/RequestDetails'
import { ReviewActions } from '../components/ReviewActions'
import { DecisionHistory } from '../components/DecisionHistory'
import { RequestStatusPanel } from '../status/RequestStatusPanel'
import { useRequestResource } from '../status/useRequestResource'
import { getEventRequest, listReviewDecisions } from '../eventReviewService'
import { orDash } from '../formatters'
import { LOCKED_STATUSES } from '../eventChangeRequestService'
import { ChangeRequestList } from '../components/ChangeRequestList'
import { ChangeRequestReviewPanel } from '../components/ChangeRequestReviewPanel'
import type { ReviewDecision } from '../types'
import { ArrangementReviewPanel } from '../components/ArrangementReviewPanel'
import { OrganiserVenueArrangements } from '../components/OrganiserVenueArrangements'
import { OrganiserEquipmentArrangements } from '../components/OrganiserEquipmentArrangements'
import { EQUIPMENT_EDITABLE_STATUSES } from '../../equipment/validation'
import { RegistrationSettingPanel } from '../components/RegistrationSettingPanel'
import { EventWaitlistPanel } from '../../registrations/components/EventWaitlistPanel'
import { canChangeRegistration } from '../statusRules'
import { PlanningUpdatePanel } from '../components/PlanningUpdatePanel'
import { EventReadinessCard } from '../readiness/EventReadinessCard'
import { EventVenueBookings } from '../components/EventVenueBookings'

export function ReviewRequestDetailPage() {
  const { id = '' } = useParams()
  const [reviewRefreshVersion, setReviewRefreshVersion] = useState(0)
  const { profile, loading: userLoading } = useCurrentUser()

  const [reviewCount, setReviewCount] = useState<{ key: string; count: number | null } | null>(null)
  const reviewKey = `${id}:${profile?.id}`
  const updateReviewCount = useCallback((count: number | null) => {
    setReviewCount({ key: reviewKey, count })
  }, [reviewKey])
  const openArrangementCount = reviewCount?.key === reviewKey ? reviewCount.count : null

  // The decision log is internal (it names the reviewer), so only staff load it. RLS
  // enforces the same rule; skipping the query here just avoids a pointless round trip.
  const canSeeHistory = profile?.role === 'coordinator' || profile?.role === 'operations_manager'

  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: null }
    const result = await getEventRequest(id)
    return result.ok ? { ok: true as const, value: result.request } : result
  }, [id, userLoading])
  const { value: request, error, loading, refresh } = useRequestResource(
    `${id}:${profile?.id}:${profile?.role}:${userLoading}`, read,
  )

  const readHistory = useCallback(async () => {
    if (userLoading || !canSeeHistory) return { ok: true as const, value: [] as ReviewDecision[] }
    const result = await listReviewDecisions(id)
    return result.ok ? { ok: true as const, value: result.decisions } : result
  }, [id, userLoading, canSeeHistory])
  const history = useRequestResource(
    `history:${id}:${profile?.id}:${profile?.role}:${userLoading}`, readHistory,
  )
  const refreshHistory = history.refresh

  // A decision changes both the status and the trail, so both reload together.
  const refreshAll = useCallback(() => {
    refresh()
    refreshHistory()
    setReviewRefreshVersion(version => version + 1)
  }, [refresh, refreshHistory])

  return (
    <PageContainer>
      <div className="max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
          <Link to="/requests" className="hover:text-slate-900 hover:underline">
            Requests
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span className="text-slate-700">{request ? orDash(request.reference) : 'Request'}</span>
        </nav>

        <button type="button" onClick={refreshAll} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh status</button>
        {loading || userLoading ? (
          <p className="text-sm text-slate-500">Loading request…</p>
        ) : error || !request ? (
          <Card title="Request unavailable">
            <p className="text-sm text-slate-600">{error}</p>
            <Link
              to="/requests"
              className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline"
            >
              Back to all requests
            </Link>
          </Card>
        ) : (
          <div className="space-y-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-slate-500">{orDash(request.reference)}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {orDash(request.name ?? request.purpose)}
                </h1>
              </div>
            </header>

            <RequestStatusPanel request={request} organiserView={profile?.role === 'organiser'} />
            {profile?.role === 'coordinator' && request.coordinatorId === profile.id && !!openArrangementCount && (
              <a href="#arrangement-reviews" className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 hover:underline">
                Needs review: {openArrangementCount} {openArrangementCount === 1 ? 'arrangement needs' : 'arrangements need'} review. View reasons
              </a>
            )}
            <p className="text-xs text-slate-500">Status updates automatically every 30 seconds.</p>

            {profile?.role === 'coordinator' && request.coordinatorId === profile.id && (
              <>
                <EventReadinessCard key={request.id} eventId={request.id} refreshVersion={reviewRefreshVersion} status={request.status} onSent={refreshAll} />
                <EventVenueBookings key={`bookings:${request.id}:${profile.id}`} eventId={request.id} refreshVersion={reviewRefreshVersion} />
              </>
            )}

            <Card title="Request details">
              <RequestDetails request={request} />
            </Card>

            {profile?.role === 'organiser' && request.organiserId === profile.id && (
              <>
                <OrganiserVenueArrangements key={`venue:${request.id}:${profile.id}`} eventId={request.id}
                  refreshVersion={reviewRefreshVersion} />
                <OrganiserEquipmentArrangements key={`equipment:${request.id}:${profile.id}`} eventId={request.id}
                  refreshVersion={reviewRefreshVersion} />
              </>
            )}

            <Card title="Requested changes" description="Changes proposed by the organiser for this event.">
              {profile?.role === 'coordinator' ? <ChangeRequestReviewPanel
                key={`${request.id}:${profile.id}`} eventId={request.id} onReviewed={refreshAll}
              /> : <ChangeRequestList
                key={`${request.id}:${profile?.id}:${profile?.role}`}
                eventId={request.id}
                organiserId={request.organiserId}
                currentUserId={profile?.id}
              />}
            </Card>

            {profile?.role === 'coordinator' && request.coordinatorId === profile.id && (
              <ArrangementReviewPanel key={`${request.id}:${profile.id}`} eventId={request.id} refreshVersion={reviewRefreshVersion} onCount={updateReviewCount} />
            )}

            {profile?.role === 'coordinator' && (
              <div id="event-decision">
              <Card
                title="Decision"
                description="Your note is shared with the organiser, who is emailed when you approve or reject."
              >
                <ReviewActions
                  eventId={request.id}
                  status={request.status}
                  onReviewed={refreshAll}
                />
              </Card>
              </div>
            )}

            {profile?.role === 'coordinator' && request.coordinatorId === profile.id
              && canChangeRegistration(request.status) && (
              <Card title="Attendee registration" description="Choose whether attendees can register for this event.">
                <RegistrationSettingPanel
                  key={request.id}
                  eventId={request.id}
                  enabled={request.registrationRequired}
                  onChanged={refreshAll}
                />
              </Card>
            )}

            {profile?.role === 'coordinator' && request.coordinatorId === profile.id
              && canChangeRegistration(request.status) && (
              <Card title="Waiting list"
                description="People waiting for a place, in first-come-first-served order. You can move someone to change who is offered the next place.">
                <EventWaitlistPanel key={request.id} eventId={request.id} />
              </Card>
            )}

            {((profile?.role === 'organiser' && request.organiserId === profile.id)
              || (profile?.role === 'coordinator' && request.coordinatorId === profile.id)) && (
              <Card
                title="Registrations"
                description="Who has registered for this event, and how many places are taken."
              >
                <Link
                  to={`/requests/${request.id}/registrations`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  Open registrations
                </Link>
              </Card>
            )}

            {profile?.role === 'coordinator' && EQUIPMENT_EDITABLE_STATUSES.includes(request.status) && (
              <Card
                title="Equipment requirements"
                description="Turn the organiser's equipment request into catalogue items for Technical Support."
              >
                <Link
                  to={`/requests/${request.id}/equipment`}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  Open equipment requirements
                </Link>
              </Card>
            )}

            {profile?.role === 'coordinator' && request.coordinatorId === profile.id && (
              <div id="planning-details">
              <Card title="Planning details and history">
                <PlanningUpdatePanel key={request.id} eventId={request.id} onChanged={refreshAll} />
              </Card>
              </div>
            )}

            {canSeeHistory && (
              <Card
                title="Decision history"
                description="Every review decision on this request, with its reason and reviewer. Internal to staff."
              >
                {history.loading ? (
                  <p className="text-sm text-slate-500">Loading decision history…</p>
                ) : history.error ? (
                  <p role="alert" className="text-sm text-red-700">{history.error}</p>
                ) : (
                  <DecisionHistory decisions={history.value ?? []} />
                )}
              </Card>
            )}

            {profile?.role === 'organiser' && !LOCKED_STATUSES.includes(request.status) && (
              <Link
                to={`/requests/${request.id}/request-change`}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2
                  text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Request changes
              </Link>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
