import { useEffect, useState } from 'react'
import { loadSpaceLayouts } from '../bookingSpaceService'
import type { BookingSpace, SpaceLayout } from '../bookingSpaceService'

export function BookingSpaceFields({ venueId, value, onChange, disabled }: {
  venueId: string; value: BookingSpace; onChange: (value: BookingSpace) => void; disabled: boolean
}) {
  const [layouts, setLayouts] = useState<SpaceLayout[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setLayouts([]); setError('')
    loadSpaceLayouts(venueId).then(data => { if (!cancelled) setLayouts(data) })
      .catch(() => { if (!cancelled) setError('Venue layouts could not be loaded. Reload before booking.') })
    return () => { cancelled = true }
  }, [venueId])
  return <fieldset disabled={disabled || !layouts.length} className="space-y-3">
    <legend className="font-semibold">Requirements for this space</legend>
    {error && <p role="alert">{error}</p>}
    <label className="block">Layout for this booking
      <select aria-label="Layout for this booking" value={value.layout} onChange={e => onChange({ ...value, layout: e.target.value })} className="block rounded border p-2">
        <option value="">Choose layout</option>
        {layouts.map(l => <option key={l.layout} value={l.layout}>{l.layout} (capacity {l.capacity})</option>)}
      </select>
    </label>
    <label className="block">People in this space
      <input aria-label="People in this space" type="number" min="1" step="1" value={value.attendance || ''}
        onChange={e => onChange({ ...value, attendance: Number(e.target.value) })} className="block rounded border p-2" />
    </label>
    <p className="text-sm">These requirements belong to this venue booking. Other spaces can have different layouts and attendance.</p>
  </fieldset>
}
