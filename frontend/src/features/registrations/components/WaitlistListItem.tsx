import { Link } from 'react-router-dom'
import { formatDateTime } from '../../events/formatters'
import type { MyWaitlistEntry } from '../types'
import { canAcceptOffer } from '../validation'
import { leaveWaitlist } from '../waitlistService'
import { EventWhenWhere } from './EventWhenWhere'
import { WaitlistButton } from './WaitlistButton'

interface WaitlistListItemProps {
  entry: MyWaitlistEntry
  onChanged: () => void
  onStale: (reason: string) => void
}

/** One of the Attendee's waiting-list entries (US16): where they stand, or the offer to accept. */
export function WaitlistListItem({ entry, onChanged, onStale }: WaitlistListItemProps) {
  const offerLive = canAcceptOffer(entry, new Date())
  const expired = entry.status === 'expired' || (entry.status === 'offered' && !offerLive)
  const link = `/events/open/${entry.eventId}`

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-semibold text-slate-900">
        <Link to={link} className="text-indigo-700 underline-offset-2 hover:underline">{entry.eventName}</Link>
      </p>
      <EventWhenWhere start={entry.start} venue={entry.venue} />
      {entry.status === 'waiting' && (
        <p className="mt-3 text-sm text-slate-700">Waiting list position: <strong>{entry.position}</strong></p>
      )}
      {offerLive && (
        <p className="mt-3 text-sm text-emerald-900">
          A place is held for you until {formatDateTime(entry.offerExpiresAt)} (Singapore time).{' '}
          <Link to={link} className="font-medium underline">Accept it</Link>
        </p>
      )}
      {expired && (
        <p className="mt-3 text-sm text-amber-800">Your offer expired and the place passed to the next person.</p>
      )}
      {!expired && (
        <div className="mt-3">
          <WaitlistButton quiet label="Leave the waiting list" pendingLabel="Leaving…"
            action={() => leaveWaitlist(entry.entryId)} onDone={onChanged} onStale={onStale} />
        </div>
      )}
    </li>
  )
}
