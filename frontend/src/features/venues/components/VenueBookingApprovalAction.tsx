import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { useCurrentUser } from '../../auth/sessionContext'
import { approveVenueBooking } from '../venueBookingApprovalService'
import type { VenueBookingReview } from '../venueBookingReviewService'

export function VenueBookingApprovalAction({ booking, onApproved, onBusyChange }: {
  booking: VenueBookingReview; onApproved: () => void; onBusyChange?: (busy: boolean) => void
}) {
  const { profile, loading } = useCurrentUser()
  const mounted = useRef(true)
  const submitted = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  if (loading || profile?.role !== 'venue_staff' || booking.status !== 'pending_approval') return null
  const available = Boolean(booking.reviewVersion && booking.conflictCheckAvailable && booking.conflicts?.length === 0)
  return <div className="space-y-2">
    {!available && <p>Approval requires complete timing and no displayed venue conflicts. Reload after resolving the request.</p>}
    {error && <p role="alert">{error}</p>}
    <Button type="button" disabled={!available || busy || submitted.current} onClick={async () => {
      if (submitted.current || !booking.reviewVersion) return
      submitted.current = true
      setBusy(true)
      onBusyChange?.(true)
      const result = await approveVenueBooking(booking.id, booking.reviewVersion)
      if (!mounted.current) return
      setBusy(false)
      onBusyChange?.(false)
      if (!result.ok) { setError(result.reason); return }
      onApproved()
    }}>{busy ? 'Approving…' : 'Approve booking'}</Button>
  </div>
}
