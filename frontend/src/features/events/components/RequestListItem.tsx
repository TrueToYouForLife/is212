import { Link } from 'react-router-dom'
import { formatDateTime, orDash } from '../formatters'
import { StatusBadge } from './StatusBadge'
import type { EventRequestSummary } from '../types'

export function RequestListItem({ request, organiserView = false, assignedToYou = false }: { request: EventRequestSummary; organiserView?: boolean; assignedToYou?: boolean }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <Link
        to={`/requests/${request.id}`}
        className="block rounded-xl p-5 focus:outline-none focus-visible:ring-2
          focus-visible:ring-indigo-500"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500">{orDash(request.reference)}</p>
            {assignedToYou && <p className="mt-1 text-xs font-semibold text-indigo-700">Assigned to you</p>}
            <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
              {orDash(request.name ?? request.purpose)}
            </h3>
          </div>
          <StatusBadge status={request.status} organiserView={organiserView} reviewNote={request.reviewNote} />
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Starts</dt>
            <dd className="mt-0.5 text-slate-800">{formatDateTime(request.proposedStart)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Expected attendance</dt>
            <dd className="mt-0.5 text-slate-800">{orDash(request.expectedAttendance)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Submitted</dt>
            <dd className="mt-0.5 text-slate-800">{formatDateTime(request.submittedAt)}</dd>
          </div>
        </dl>
      </Link>
    </li>
  )
}
