import { Link } from 'react-router-dom'
import { formatDateTime } from '../../events/formatters'
import { joinWaitlist, leaveWaitlist } from '../waitlistService'
import type { OpenEventDetails, WaitlistState } from '../types'
import { canAcceptOffer } from '../validation'
import { RegistrationForm } from './RegistrationForm'
import { WaitlistButton } from './WaitlistButton'

interface RegisterOrWaitlistProps {
  event: OpenEventDetails
  hasPrerequisites: boolean
  /** Reload the event after the Attendee's waiting-list state changed. */
  onChanged: () => void
  onNotice: (message: string) => void
}

/**
 * US16: what the Register card offers. A place goes to the registration form; a full event goes to
 * the waiting list (AC-016.1); an offer goes to the same form, which then accepts it (AC-016.3).
 * The database decides every one of these again, so a stale page is told and reloads.
 */
export function RegisterOrWaitlist({ event, hasPrerequisites, onChanged, onNotice }: RegisterOrWaitlistProps) {
  const waitlist = event.waitlist
  const stale = (reason: string) => { onNotice(reason); onChanged() }
  const leaveButton = (entry: WaitlistState) => (
    <WaitlistButton quiet label="Leave the waiting list" pendingLabel="Leaving…"
      action={() => leaveWaitlist(entry.entryId)} onDone={onChanged} onStale={stale} />
  )

  if (event.registered) {
    return (
      <p className="text-sm text-slate-700">
        You&apos;re registered for this event.{' '}
        <Link to="/registrations" className="font-medium text-indigo-700 underline">My registrations</Link>
      </p>
    )
  }

  const now = new Date()
  if (waitlist && canAcceptOffer(waitlist, now)) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          A place is being held for you until {formatDateTime(waitlist.offerExpiresAt)} (Singapore time).
          Confirm your details to take it, or it passes to the next person.
        </p>
        <RegistrationForm eventId={event.id} hasPrerequisites={hasPrerequisites} waitlistEntryId={waitlist.entryId} />
        {leaveButton(waitlist)}
      </div>
    )
  }

  if (waitlist?.status === 'waiting') {
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm text-slate-700">
          You&apos;re on the waiting list at position <strong>{waitlist.position}</strong>. We&apos;ll email you if
          a place opens, and you&apos;ll have 3 days to accept it.
        </p>
        {leaveButton(waitlist)}
      </div>
    )
  }

  if (event.full) {
    // An offer that lapsed while the page stayed open reads as expired here.
    const lapsed = waitlist?.status === 'expired' || waitlist?.status === 'offered'
    return (
      <div className="space-y-3">
        {lapsed && (
          <p role="status" className="text-sm text-amber-800">
            Your offer expired and the place passed to the next person.
          </p>
        )}
        <p className="text-sm text-slate-700">
          This event is full. Join the waiting list and we&apos;ll offer you a place if one opens, in the order
          people joined.
        </p>
        <WaitlistButton label="Join the waiting list" pendingLabel="Joining…"
          action={() => joinWaitlist(event.id)} onDone={onChanged} onStale={stale} />
      </div>
    )
  }

  return <RegistrationForm eventId={event.id} hasPrerequisites={hasPrerequisites} />
}
