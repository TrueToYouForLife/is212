import { organiserStatusLabel } from '../status/organiserStatusLabel'
import { EVENT_STATUS_LABELS } from '../types'
import type { EventStatus } from '../types'

// Colour carries meaning here, so the label is always present too — a badge that is only
// "red" is unreadable to a screen reader and to anyone who cannot distinguish the hues.
const TONES: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-800',
  approved: 'bg-emerald-50 text-emerald-700',
  planning: 'bg-indigo-50 text-indigo-700',
  awaiting_safety_review: 'bg-amber-50 text-amber-800',
  safety_changes_requested: 'bg-orange-50 text-orange-800',
  in_preparation: 'bg-teal-50 text-teal-700',
  confirmed: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-slate-100 text-slate-500',
  // Closed without a decision, so it reads as settled rather than refused —
  // the same neutral grey as cancelled, not the red of rejected (AC-022.2).
  rejected: 'bg-red-50 text-red-700',
  withdrawn: 'bg-slate-100 text-slate-500',
}

export function StatusBadge({ status, organiserView = false, reviewNote }: {
  status: EventStatus; organiserView?: boolean; reviewNote?: string | null
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[status]}`}
    >
      {organiserView ? organiserStatusLabel(status, reviewNote) : EVENT_STATUS_LABELS[status]}
    </span>
  )
}
