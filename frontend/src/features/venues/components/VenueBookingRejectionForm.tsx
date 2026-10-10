import type { VenueBookingStatus } from '../bookingTypes'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea } from '../../../components/ui/FormControls'
import { rejectVenueBooking } from '../venueBookingReviewService'
import { rejectionReasonError } from '../venueBookingReviewValidation'
import { useCurrentUser } from '../../auth/sessionContext'

export interface RejectionFormProps {
  bookingId: string
  status: VenueBookingStatus
  onRejected: () => void
  onBusyChange?: (busy: boolean) => void
}

export function VenueBookingRejectionForm({ bookingId, status, onRejected, onBusyChange }: RejectionFormProps) {
  const id = useId()
  const { profile, loading } = useCurrentUser()
  const submitting = useRef(false)
  const mounted = useRef(true)
  const [reason, setReason] = useState('')
  const [alternative, setAlternative] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  if (loading || profile?.role !== 'venue_staff') return null
  if (done) return <p role="status">Booking rejected.</p>
  if (status !== 'pending_approval') return null

  return (
    <form className="space-y-4" noValidate onSubmit={async (event) => {
      event.preventDefault()
      if (submitting.current || failed) return
      const invalid = rejectionReasonError(reason)
      setError(invalid)
      if (invalid) return
      submitting.current = true
      setBusy(true)
      onBusyChange?.(true)
      const result = alternative.trim()
        ? await rejectVenueBooking(bookingId, reason, alternative)
        : await rejectVenueBooking(bookingId, reason)
      // Navigation or manual reload may have replaced this form while saving.
      if (!mounted.current) return
      submitting.current = false
      setBusy(false)
      onBusyChange?.(false)
      if (!result.ok) { setError(result.reason); setFailed(true); return }
      setDone(true)
      onRejected()
    }}>
      <Field id={id} label="Rejection reason">
        <TextArea id={id} required value={reason} disabled={busy || failed}
          onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Field id={`${id}-alternative`} label="Suggested alternative (optional)">
        <TextArea id={`${id}-alternative`} value={alternative} disabled={busy || failed}
          onChange={(event) => setAlternative(event.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy || failed}>{busy ? 'Rejecting…' : 'Reject booking'}</Button>
    </form>
  )
}
