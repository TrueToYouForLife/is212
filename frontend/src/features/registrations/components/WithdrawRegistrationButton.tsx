import { useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import { withdrawRegistration } from '../registrationService'
import type { MyRegistration } from '../types'

interface WithdrawRegistrationButtonProps {
  registration: MyRegistration
  /** The withdrawal took effect; the page reloads and thanks the Attendee. */
  onWithdrawn: (eventName: string) => void
  /** The registration is no longer withdrawable (already withdrawn, started, closed); reload. */
  onStale: (reason: string) => void
}

/**
 * US23 AC-023.2: "Withdraw" asks first and only calls the database once the Attendee confirms.
 * The page owns the success message, because the reload that follows removes this button.
 */
export function WithdrawRegistrationButton({ registration, onWithdrawn, onStale }: WithdrawRegistrationButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A ref, not the pending state: two clicks in the same tick both see pending = false, and the
  // database would refuse the second one anyway, but the Attendee would then see an error.
  const inFlight = useRef(false)

  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)

    const result = await withdrawRegistration(registration.registrationId)
    inFlight.current = false

    if (result.ok) {
      onWithdrawn(registration.eventName)
      return
    }
    if (result.stale) {
      onStale(result.reason)
      return
    }
    // A failure the Attendee can retry: the registration is unchanged, so keep the button.
    setPending(false)
    setConfirming(false)
    setError(result.reason)
  }

  if (!confirming) {
    return (
      <div className="mt-3 space-y-2">
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <Button type="button" className="bg-white !text-red-700 ring-1 ring-red-200 hover:bg-red-50"
          onClick={() => { setError(null); setConfirming(true) }}>
          Withdraw
        </Button>
      </div>
    )
  }

  const headingId = `withdraw-${registration.registrationId}`
  return (
    <div role="alertdialog" aria-labelledby={headingId} className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <p id={headingId} className="text-sm font-medium text-red-900">
        Withdraw from {registration.eventName}?
      </p>
      <p className="mt-1 text-sm text-red-800">
        Your place will be released. You can register again while registration is open.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={confirm} className="bg-red-600 hover:bg-red-700">
          {pending ? 'Withdrawing…' : 'Yes, withdraw'}
        </Button>
        <Button type="button" disabled={pending} onClick={() => setConfirming(false)}
          className="bg-white !text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          Keep my registration
        </Button>
      </div>
    </div>
  )
}
