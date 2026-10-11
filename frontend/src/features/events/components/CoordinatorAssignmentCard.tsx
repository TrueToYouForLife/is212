import { formatDateTime, orDash } from '../formatters'
import type { EventRequestSummary } from '../types'
import type { CoordinatorOption } from '../coordinatorAssignmentService'
import { CoordinatorAssignmentForm } from './CoordinatorAssignmentForm'
import { StatusBadge } from './StatusBadge'
import { Link } from 'react-router-dom'

interface Props {
  request: EventRequestSummary
  coordinators: CoordinatorOption[]
  disabled: boolean
  onAssigned: () => void
}

export function CoordinatorAssignmentCard({ request, coordinators, disabled, onAssigned }: Props) {
  const current = coordinators.find(coordinator => coordinator.id === request.coordinatorId)
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-mono text-xs text-slate-500">{orDash(request.reference)}</p>
      <h3 className="mt-1 font-semibold text-slate-900">{orDash(request.name)}</h3>
      <StatusBadge status={request.status} />
      <Link to={`/requests/${request.id}`} className="ml-3 text-sm font-medium text-indigo-700 hover:underline"
        aria-label={`Open event ${orDash(request.name)}`}>Open event</Link>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{orDash(request.purpose)}</p>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-slate-500">Event type</dt><dd>{orDash(request.eventType)}</dd></div>
        <div><dt className="text-slate-500">Starts (Singapore time)</dt><dd>{formatDateTime(request.proposedStart)}</dd></div>
        <div><dt className="text-slate-500">Ends (Singapore time)</dt><dd>{formatDateTime(request.proposedEnd)}</dd></div>
        <div><dt className="text-slate-500">Expected attendance</dt><dd>{orDash(request.expectedAttendance)}</dd></div>
      </dl>
      <p className="mt-4 text-sm font-medium text-slate-700">
        Current coordinator: {request.coordinatorId
          ? current?.name ?? (disabled ? 'Loading unavailable' : 'Coordinator no longer available')
          : 'Unassigned'}
      </p>
      {/* A changed assignment invalidates a selection made against the previous assignee. */}
      <CoordinatorAssignmentForm key={`${request.id}:${request.coordinatorId}`} eventId={request.id}
        eventName={orDash(request.name)} currentCoordinatorId={request.coordinatorId}
        coordinators={coordinators} disabled={disabled} onAssigned={onAssigned} />
    </li>
  )
}
