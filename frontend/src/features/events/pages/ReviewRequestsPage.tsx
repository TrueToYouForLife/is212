import { useCallback } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { RequestListItem } from '../components/RequestListItem'
import { CoordinatorAssignmentQueue } from '../components/CoordinatorAssignmentQueue'
import { listArrangementReviewCounts } from '../arrangementReviewService'
import { loadCoordinatorNames } from '../eventCoordinatorService'
import { describeCoordinator } from '../coordinatorLabel'
import { listEventRequests } from '../eventReviewService'
import { useRequestResource } from '../status/useRequestResource'
import type { EventRequestSummary } from '../types'

/**
 * Role-specific request views. RLS controls readable rows; the Lead's queue further
 * filters those rows to submitted requests still needing an assignment.
 */
export function ReviewRequestsPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const read = useCallback(async () => {
    if (userLoading) return { ok: true as const, value: [] }
    const result = await listEventRequests(profile?.role === 'organiser')
    return result.ok ? { ok: true as const, value: result.requests } : result
  }, [profile?.role, userLoading])
  const { value, error, loading, refresh } = useRequestResource(
    `${profile?.id}:${profile?.role}:${userLoading}`, read,
  )
  const readCounts = useCallback(async () => {
    if (userLoading || profile?.role !== 'coordinator') return { ok: true as const, value: {} as Record<string, number> }
    return listArrangementReviewCounts()
  }, [userLoading, profile?.role])
  const counts = useRequestResource(`counts:${profile?.id}:${profile?.role}:${userLoading}`, readCounts)
  const requests = value ?? []

  // Who coordinates each event, by name. A Lead's cards already name them, so only the other views ask.
  const requestIds = requests.map(request => request.id).join(',')
  const readNames = useCallback(async () => {
    if (userLoading || profile?.role === 'coordinator_lead' || !requestIds) return { ok: true as const, value: {} as Record<string, string> }
    return loadCoordinatorNames(requestIds.split(','))
  }, [userLoading, profile?.role, requestIds])
  const names = useRequestResource(`names:${profile?.id}:${profile?.role}:${requestIds}`, readNames)
  const labelFor = (request: EventRequestSummary) =>
    describeCoordinator(request.coordinatorId, names.value?.[request.id], profile?.id)

  const isCoordinator = profile?.role === 'coordinator'
  const isManager = profile?.role === 'operations_manager'
  const isLead = profile?.role === 'coordinator_lead'
  const assignedRequests = requests.filter(request => request.coordinatorId === profile?.id)
  const otherRequests = requests.filter(request => request.coordinatorId !== profile?.id)

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          {isLead ? 'Coordinator Lead' : isManager ? 'Event operations manager' : isCoordinator ? 'Event coordinator' : 'Event requests'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {isLead ? 'Coordinator assignments' : isCoordinator || isManager ? 'Incoming requests' : 'Your requests'}
        </h1>
        {!isCoordinator && <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {isLead ? 'Assign submitted requests and manage coordinator assignments for active events.' : isManager ? 'View submitted events and their current progress.'
            : 'Your event requests, including drafts. Status updates automatically every 30 seconds.'}
        </p>}
      </div>

      <button type="button" onClick={() => { refresh(); counts.refresh() }} className="mb-4 text-sm font-medium text-indigo-700 hover:underline">Refresh requests</button>

      {isCoordinator && counts.error && <p role="alert" className="mb-4 text-sm text-red-700">Review indicators are unavailable. Refresh requests to try again.</p>}
      {userLoading || loading ? (
        <p className="text-sm text-slate-500">Loading requests…</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </div>
      ) : isLead ? (
        <CoordinatorAssignmentQueue requests={requests} onAssigned={refresh} />
      ) : isCoordinator ? (
        <div className="space-y-8">
          <section aria-labelledby="assigned-to-me-heading">
            <h2 id="assigned-to-me-heading" className="mb-4 text-lg font-semibold text-slate-900">Assigned to me</h2>
            {assignedRequests.length === 0 ? (
              <p className="text-sm text-slate-600">No event requests are assigned to you yet.</p>
            ) : (
              <ul className="space-y-4">
                {assignedRequests.map(request => <RequestListItem key={request.id} request={request} assignedToYou coordinatorLabel={labelFor(request)} arrangementReviewCount={counts.value?.[request.id] ?? 0} />)}
              </ul>
            )}
          </section>
          <section aria-labelledby="other-event-requests-heading">
            <h2 id="other-event-requests-heading" className="mb-4 text-lg font-semibold text-slate-900">Other event requests</h2>
            {otherRequests.length === 0 ? (
              <p className="text-sm text-slate-600">No other event requests to show.</p>
            ) : (
              <ul className="space-y-4">
                {otherRequests.map(request => <RequestListItem key={request.id} request={request} coordinatorLabel={labelFor(request)} />)}
              </ul>
            )}
          </section>
        </div>
      ) : requests.length === 0 ? (
        <Card title="Nothing here yet">
          <p className="text-sm text-slate-600">
            {isCoordinator || isManager
              ? 'No requests have been submitted yet. They appear here the moment an organiser submits one.'
              : 'You have not created any event requests yet.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => (
            <RequestListItem key={request.id} request={request} organiserView={profile?.role === 'organiser'} coordinatorLabel={labelFor(request)} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
