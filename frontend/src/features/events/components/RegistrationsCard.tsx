import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { loadRegistrationCount } from '../registrationCountService'

type RegistrationsCardProps = {
  eventId: string
  /** True when the signed-in user is the organiser who owns this event. */
  isOwner: boolean
}

/**
 * US54 AC-054.4: the owner gets a route into the registrations list; a colleague gets the
 * count only, and no way into the list itself.
 */
export function RegistrationsCard({ eventId, isOwner }: RegistrationsCardProps) {
  // Keyed by event so a stale count from a previous event is never shown for this one.
  const [result, setResult] = useState<{ eventId: string; count: number | null } | null>(null)

  useEffect(() => {
    // Owners get the full registrations page instead, so no count fetch is needed.
    if (isOwner) return
    let active = true
    loadRegistrationCount(eventId)
      .then((response) => {
        if (active) setResult({ eventId, count: response.ok ? response.count : null })
      })
      .catch(() => { if (active) setResult({ eventId, count: null }) })
    return () => { active = false }
  }, [eventId, isOwner])

  if (isOwner) {
    return <Card
      title="Registrations"
      description="Who has registered for this event, and how many places are taken.">
      <Link to={`/requests/${eventId}/registrations`}
        className="text-sm font-medium text-indigo-700 hover:underline">
        Open registrations
      </Link>
    </Card>
  }

  const current = result?.eventId === eventId ? result : null

  return <Card
    title="Registrations"
    description="How many people have registered for this event.">
    {current === null ? <p role="status" className="text-sm text-slate-500">Loading&hellip;</p>
      : current.count === null
        ? <p className="text-sm text-slate-500">Registration count unavailable.</p>
      : <p data-testid="registration-count" className="text-sm text-slate-500">
          <span className="text-2xl font-semibold text-slate-900">{current.count}</span>{' '}
          {current.count === 1 ? 'registration' : 'registrations'}
        </p>}
  </Card>
}
