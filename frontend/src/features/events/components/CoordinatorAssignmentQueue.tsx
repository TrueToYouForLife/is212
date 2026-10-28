import { useState } from 'react'
import type { EventRequestSummary } from '../types'
import { EVENT_STATUS_LABELS } from '../types'
import { listAssignmentCoordinators } from '../coordinatorAssignmentService'
import { useRequestResource } from '../status/useRequestResource'
import { CoordinatorAssignmentCard } from './CoordinatorAssignmentCard'

const ACTIVE_STATUSES = [
  'submitted', 'under_review', 'approved', 'planning',
  'awaiting_safety_review', 'safety_changes_requested', 'in_preparation', 'confirmed',
] as const

/** Queue membership is presentation; Lead read/write permissions remain in the database. */
export function CoordinatorAssignmentQueue({ requests, onAssigned }: { requests: EventRequestSummary[]; onAssigned: () => void }) {
  const { value: coordinators, error, loading, refresh } = useRequestResource('assignment-coordinators', listAssignmentCoordinators)
  const [success, setSuccess] = useState<string | null>(null)
  const [coordinatorFilter, setCoordinatorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const filtering = coordinatorFilter !== '' || statusFilter !== ''
  const visibleRequests = requests.filter(request =>
    (!statusFilter || request.status === statusFilter)
    && (!coordinatorFilter || (coordinatorFilter === 'unassigned'
      ? !request.coordinatorId : request.coordinatorId === coordinatorFilter)),
  )
  function assigned(reassignment: boolean) {
    setSuccess(reassignment ? 'Coordinator reassigned successfully.' : 'Coordinator assigned successfully.')
    onAssigned()
    refresh()
  }
  const activeEvents = visibleRequests.filter(request =>
    ACTIVE_STATUSES.some(status => status === request.status),
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
      <fieldset className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Filter events</legend>
        <label className="text-sm text-slate-700">Filter by coordinator
          <select value={coordinatorFilter} onChange={event => setCoordinatorFilter(event.target.value)}
            className="mt-1 block rounded-md border border-slate-300 bg-white p-2">
            <option value="">All coordinators</option>
            <option value="unassigned">Unassigned</option>
            {(coordinators ?? []).map(coordinator => (
              <option key={coordinator.id} value={coordinator.id}>{coordinator.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">Filter by status
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}
            className="mt-1 block rounded-md border border-slate-300 bg-white p-2">
            <option value="">All active statuses</option>
            {ACTIVE_STATUSES.map(status => <option key={status} value={status}>{EVENT_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <button type="button" disabled={!filtering}
          onClick={() => { setCoordinatorFilter(''); setStatusFilter('') }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Reset filters</button>
      </fieldset>
      <section aria-labelledby="active-events-heading">
        <h2 id="active-events-heading" className="mb-4 text-lg font-semibold text-slate-900">Active events</h2>
        {activeEvents.length === 0 ? (
          <p className="text-sm text-slate-600">{filtering ? 'No active events match these filters.' : 'No active events.'}</p>
        ) : cards(activeEvents)}
      </section>
    </div>
  )
}
