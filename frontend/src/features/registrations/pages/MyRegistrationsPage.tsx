import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Card } from '../../../components/ui/Card'
import { ErrorAlert } from '../../../components/ui/ErrorAlert'
import { useCurrentUser } from '../../auth/sessionContext'
import { useRequestResource } from '../../events/status/useRequestResource'
import { RegistrationListItem } from '../components/RegistrationListItem'
import { WaitlistListItem } from '../components/WaitlistListItem'
import { loadMyRegistrations } from '../registrationService'
import { loadMyWaitlist } from '../waitlistService'

/**
 * US15 AC-015.7: the signed-in Attendee's registrations. Refreshed periodically and on focus,
 * so an event that is cancelled or completed shows its new status without a manual reload.
 * US23: a withdrawal reloads the list so the row shows Withdrawn, and the outcome is told here,
 * because the row's own Withdraw button disappears with that reload.
 */
export function MyRegistrationsPage() {
  const { session, loading } = useCurrentUser()
  // Nothing to ask for until someone is signed in; the functions refuse anonymous callers anyway.
  const signedInAs = session?.userId ?? ''
  const read = useCallback(
    () => (signedInAs ? loadMyRegistrations() : Promise.resolve({ ok: true as const, value: [] })),
    [signedInAs],
  )
  const { value: registrations, error, refresh } = useRequestResource(`my-registrations:${signedInAs}`, read)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // US16: the Attendee's waiting lists, refreshed the same way so an offer shows up without a reload.
  const readWaitlist = useCallback(
    () => (signedInAs ? loadMyWaitlist() : Promise.resolve({ ok: true as const, value: [] })),
    [signedInAs],
  )
  const { value: waitlist, refresh: refreshWaitlist } = useRequestResource(`my-waitlist:${signedInAs}`, readWaitlist)
  const handleWaitlistChanged = () => refreshWaitlist()
  const handleWaitlistStale = (reason: string) => {
    setNotice({ tone: 'error', text: reason })
    refreshWaitlist()
  }

  const handleWithdrawn = (eventName: string) => {
    setNotice({ tone: 'success', text: `Your registration for ${eventName} has been withdrawn.` })
    refresh()
  }
  // Already withdrawn elsewhere, or the event started: say so, and show the real state.
  const handleStale = (reason: string) => {
    setNotice({ tone: 'error', text: reason })
    refresh()
  }

  if (loading) return <PageContainer><p className="text-sm text-slate-500">Loading…</p></PageContainer>
  if (!session) return <Navigate to="/signin" replace state={{ from: '/registrations' }} />

  return (
    <PageContainer>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">My registrations</h1>
      <div className="mt-6">
        {notice?.tone === 'success' && (
          <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {notice.text}
          </p>
        )}
        {notice?.tone === 'error' && <div className="mb-4"><ErrorAlert>{notice.text}</ErrorAlert></div>}
        {error ? (
          <ErrorAlert onRetry={refresh}>{error}</ErrorAlert>
        ) : !registrations ? (
          <p className="text-sm text-slate-500">Loading registrations…</p>
        ) : registrations.length === 0 ? (
          <Card title="No registrations yet">
            <p className="text-sm text-slate-600">
              You have not registered for any events yet.{' '}
              <Link to="/events/open" className="font-medium text-indigo-700 underline">
                Events open for registration
              </Link>
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {registrations.map((registration) => (
              <RegistrationListItem
                key={registration.registrationId}
                registration={registration}
                onWithdrawn={handleWithdrawn}
                onStale={handleStale}
              />
            ))}
          </ul>
        )}
      </div>

      {waitlist && waitlist.length > 0 && (
        <section aria-labelledby="waiting-lists" className="mt-10">
          <h2 id="waiting-lists" className="text-xl font-bold tracking-tight text-slate-900">Waiting lists</h2>
          <ul className="mt-4 space-y-3">
            {waitlist.map((entry) => (
              <WaitlistListItem key={entry.entryId} entry={entry}
                onChanged={handleWaitlistChanged} onStale={handleWaitlistStale} />
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  )
}
