import { useState } from 'react'
import type { EventRequestSummary } from '../types'
import { listAssignmentCoordinators } from '../coordinatorAssignmentService'
import { useRequestResource } from '../status/useRequestResource'
import { CoordinatorAssignmentCard } from './CoordinatorAssignmentCard'

/** Queue membership is presentation; Lead read/write permissions remain in the database. */
export function CoordinatorAssignmentQueue({ requests, onAssigned }: { requests: EventRequestSummary[]; onAssigned: () => void }) {
  const { value: coordinators, error, loading, refresh } = useRequestResource('assignment-coordinators', listAssignmentCoordinators)
  const [success, setSuccess] = useState<string | null>(null)
  function assigned(reassignment: boolean) {
    setSuccess(reassignment ? 'Coordinator reassigned successfully.' : 'Coordinator assigned successfully.')
    onAssigned()
    refresh()
  }
  const unassigned = requests.filter(request =>
    request.status === 'submitted' && request.coordinatorId === null,
  )
  // Submitted unassigned requests already appear above; show every other active event once.
  const activeEvents = requests.filter(request =>
    ['submitted', 'under_review', 'approved', 'planning', 'confirmed'].includes(request.status)
      && !unassigned.includes(request),
  )
  function cards(events: EventRequestSummary[]) {
    return <ul className="space-y-4">{events.map(request => (
      <CoordinatorAssignmentCard key={request.id} request={request} coordinators={coordinators ?? []}
        disabled={loading || error !== null} onAssigned={() => assigned(Boolean(request.coordinatorId))} />
    ))}</ul>
  }

  return (
    <div className="space-y-6">
      {success && <p role="status" className="mb-4 text-sm text-green-700">{success}</p>}
      {loading ? <p className="mb-4 text-sm text-slate-600">Loading coordinators…</p> : error ? (
        <div role="alert" className="mb-4 text-sm text-red-700">
          {error} <button type="button" className="underline" onClick={refresh}>Retry coordinator list</button>
        </div>
      ) : coordinators?.length === 0 ? (
        <p className="mb-4 text-sm text-slate-600">No Event Coordinator accounts are available. Contact your administrator.</p>
      ) : null}
      {!loading && !error && coordinators && coordinators.length > 0 && (
        <section aria-labelledby="coordinator-workloads-heading">
          <h2 id="coordinator-workloads-heading" className="mb-4 text-lg font-semibold text-slate-900">Coordinator workloads</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coordinators.map(coordinator => (
              <div key={coordinator.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <dt className="font-medium text-slate-900">{coordinator.name}</dt>
                <dd className="text-sm text-slate-600">{coordinator.activeEventCount} active {coordinator.activeEventCount === 1 ? 'event' : 'events'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section aria-labelledby="unassigned-requests-heading">
        <h2 id="unassigned-requests-heading" className="mb-4 text-lg font-semibold text-slate-900">Unassigned requests</h2>
        {unassigned.length === 0 ? (
        <p className="text-sm text-slate-600">No submitted requests are waiting for assignment.</p>
        ) : cards(unassigned)}
      </section>
      <section aria-labelledby="active-events-heading">
        <h2 id="active-events-heading" className="mb-4 text-lg font-semibold text-slate-900">Active events</h2>
        <p className="mb-4 text-sm text-slate-600">Submitted requests awaiting assignment appear above. All other active events appear here.</p>
        {activeEvents.length === 0 ? <p className="text-sm text-slate-600">No other active events.</p> : cards(activeEvents)}
      </section>
    </div>
  )
}
