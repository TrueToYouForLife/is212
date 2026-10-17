import { useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import type { WaitlistResult } from '../waitlistService'

interface WaitlistButtonProps {
  label: string
  pendingLabel: string
  /** Join or leave: the caller binds the id, so this component never names a person or an event. */
  action: () => Promise<WaitlistResult>
  /** The change took effect; the caller reloads. */
  onDone: () => void
  /** The picture on screen was out of date; the caller says why and reloads. */
  onStale: (reason: string) => void
  /** Visual weight: joining is the main action, leaving is secondary. */
  quiet?: boolean
}

/** US16: one waiting-list action with a double-click guard and a retryable error. */
export function WaitlistButton({ label, pendingLabel, action, onDone, onStale, quiet }: WaitlistButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A ref, not the pending state: two clicks in the same tick both see pending = false.
  const inFlight = useRef(false)

  async function run() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const result = await action()
    inFlight.current = false

    if (result.ok) { onDone(); return }
    if (result.stale) { onStale(result.reason); return }
    setPending(false)
    setError(result.reason)
  }

  return (
    <div className="space-y-2">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <Button type="button" disabled={pending} onClick={run}
        className={quiet ? 'bg-white !text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50' : undefined}>
        {pending ? pendingLabel : label}
      </Button>
    </div>
  )
}
