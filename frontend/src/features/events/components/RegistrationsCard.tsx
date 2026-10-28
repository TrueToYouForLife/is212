import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { loadRegistrationCount } from '../registrationCountService'

type RegistrationsCardProps = {
  eventId: string
  /**
   * True when the signed-in user may read the roll call itself — the Organiser who owns
   * the event, or the Coordinator assigned to it. Not "is the owner": 0114 admits both
   * through can_view_event_registrations, and the assigned Coordinator is not an owner.
   */
  canOpenRollCall: boolean
}

/**
 * US54 AC-054.4: how full an event is, for anyone allowed to know, and a route into the
 * roll call for the people allowed to read it.
 *
 * The one card for both places this appears — the request page (/requests/:id, for the
 * Organiser and the assigned Coordinator) and the organisation view
 * (/organisation/events/:id, where a colleague sees a sister event). Those were two
 * separate cards until now, which is why the request page never showed a number.
 *
 * 0114 is what actually decides. can_count_event_registrations admits everyone
 * can_view_event_registrations does, plus a same-organisation colleague, so one fetch path
 * serves every audience and there is no branch here to keep in step with it. A caller who
 * may not look gets 0, indistinguishable from an event nobody has registered for —
 * deliberately, so the difference cannot be used to discover that an event exists.
 */
export function RegistrationsCard({ eventId, canOpenRollCall }: RegistrationsCardProps) {
  // Keyed by event so a stale count from a previous event is never shown for this one.
  const [result, setResult] = useState<{ eventId: string; count: number | null } | null>(null)

  useEffect(() => {
    let active = true
    loadRegistrationCount(eventId)
      .then((response) => {
        if (active) setResult({ eventId, count: response.ok ? response.count : null })
      })
      .catch(() => { if (active) setResult({ eventId, count: null }) })
    return () => { active = false }
  }, [eventId])

  const current = result?.eventId === eventId ? result : null

  return <Card
    title="Registrations"
    description={canOpenRollCall
      ? 'How many places are taken, and who has registered.'
      : 'How many people have registered for this event.'}>
    {current === null ? <p role="status" className="text-sm text-slate-500">Loading&hellip;</p>
      : current.count === null
        // Not "0 registrations": after a failed read that is a confident wrong answer, and
        // the one the reader would plan around.
        ? <p className="text-sm text-slate-500">Registration count unavailable.</p>
      : <p data-testid="registration-count" className="text-sm text-slate-500">
          <span className="text-2xl font-semibold text-slate-900">{current.count}</span>{' '}
          {current.count === 1 ? 'registration' : 'registrations'}
        </p>}

    {/* The only thing this flag decides. A colleague is refused the names by 0114, so
        offering them this link would invite them to a page that can only turn them away. */}
    {canOpenRollCall && (
      <p className="mt-3">
        <Link to={`/requests/${eventId}/registrations`}
          className="text-sm font-medium text-indigo-700 hover:underline">
          Open registrations
        </Link>
      </p>
    )}
  </Card>
}