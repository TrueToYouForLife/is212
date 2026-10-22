import { Card } from '../../../components/ui/Card'
import { StatusBadge } from '../components/StatusBadge'
import type { EventRequestDetail, EventStatus } from '../types'

const STATUS_DESCRIPTIONS: Record<EventStatus, string> = {
  draft: 'Your event request has not been submitted yet.',
  submitted: 'Your event request is in review.',
  under_review: 'Your event request is currently being reviewed.',
  approved: 'Your event request has been approved. Event arrangements are being prepared; the event is not yet confirmed.',
  planning: 'Your event arrangements are being prepared; the event is not yet confirmed.',
  confirmed: 'Your event has been confirmed and is ready to proceed.',
  completed: 'This event has been completed.',
  rejected: 'Your event request was rejected.',
  cancelled: 'This event has been cancelled.',
  // AC-022.2: the organiser must be able to tell this apart from a rejection.
  // It was closed before anyone decided on it, which is a different outcome.
  withdrawn: 'Your event request was withdrawn before a decision was made.',
}

export function RequestStatusPanel({ request, organiserView = false }: { request: EventRequestDetail; organiserView?: boolean }) {
  const note = request.reviewNote?.trim()
  const returned = request.status === 'submitted' && Boolean(note)
  return (
    <Card title="Current status">
      <div aria-live="polite" className="space-y-4">
        <StatusBadge status={request.status} organiserView={organiserView} reviewNote={request.reviewNote} />
        <p className="text-sm text-slate-700">
          {returned
            ? 'Your event request has been returned for clarification or amendment. See the requested information below.'
            : STATUS_DESCRIPTIONS[request.status]}
        </p>
        {returned ? (
          <div>
            <h3 className="font-semibold text-amber-800">Outstanding clarification or amendment request</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note}</p>
          </div>
        ) : request.status === 'rejected' ? (
          <div>
            <h3 className="font-semibold text-red-800">Reason for rejection</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
              {note || 'No reason was recorded. Please contact your event coordinator.'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No outstanding clarification or amendment requests.</p>
        )}
      </div>
    </Card>
  )
}
