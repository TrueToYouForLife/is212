import type { MyRegistration } from '../types'
import { canWithdraw } from '../validation'
import { EventWhenWhere } from './EventWhenWhere'
import { WithdrawRegistrationButton } from './WithdrawRegistrationButton'

interface RegistrationListItemProps {
  registration: MyRegistration
  onWithdrawn: (eventName: string) => void
  onStale: (reason: string) => void
}

/** One of the Attendee's registrations (US15 AC-015.7), with Withdraw where it is still allowed (US23). */
export function RegistrationListItem({ registration, onWithdrawn, onStale }: RegistrationListItemProps) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-semibold text-slate-900">{registration.eventName}</p>
      <EventWhenWhere start={registration.start} venue={registration.venue} />
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
          Event: {registration.eventStatusLabel}
        </span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
          Registration: {registration.registrationStatusLabel}
        </span>
      </div>
      {canWithdraw(registration, new Date()) && (
        <WithdrawRegistrationButton registration={registration} onWithdrawn={onWithdrawn} onStale={onStale} />
      )}
    </li>
  )
}
