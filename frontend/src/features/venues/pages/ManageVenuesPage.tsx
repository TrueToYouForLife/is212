import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { listManagedVenues } from '../venueManagementService'
import type { ManagedVenue } from '../venueManagementService'

const STATUS_LABELS: Record<ManagedVenue['status'], string> = {
  active: 'Active',
  under_maintenance: 'Under maintenance',
  retired: 'Retired',
}

/** US46: where Venue Staff find a venue to edit or retire, or add a new one. */
export function ManageVenuesPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const isVenueStaff = profile?.role === 'venue_staff'
  const [venues, setVenues] = useState<ManagedVenue[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading || !isVenueStaff) return
    let cancelled = false
    void listManagedVenues().then((result) => {
      if (cancelled) return
      if (result.ok) setVenues(result.venues)
      else setError(result.reason)
    })
    return () => { cancelled = true }
  }, [userLoading, isVenueStaff])

  if (userLoading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Checking your session…</p>
      </PageContainer>
    )
  }

  if (!isVenueStaff) {
    return (
      <PageContainer>
        <Card title="Manage venues">
          <p className="text-sm text-slate-600">Managing venues is available to Venue Staff.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manage venues</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Edit a venue’s details or add a new one. Editing never changes an existing booking; bookings
            an edit may affect are sent to their Coordinators to review.
          </p>
        </div>
        <Link
          to="/venues/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Add venue
        </Link>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      ) : !venues ? (
        <p className="text-sm text-slate-500">Loading venues…</p>
      ) : venues.length === 0 ? (
        <Card title="No venues yet">
          <p className="text-sm text-slate-600">Add the first venue to start the catalogue.</p>
        </Card>
      ) : (
        <Card title="Venues">
          <ul className="divide-y divide-slate-200">
            {venues.map((venue) => (
              <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{venue.name}</p>
                  <p className="text-xs text-slate-500">
                    {[venue.location, `up to ${venue.capacity}`, STATUS_LABELS[venue.status]].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Link
                  to={`/venues/${venue.id}/edit`}
                  aria-label={`Edit ${venue.name}`}
                  className="text-sm font-semibold text-indigo-700 hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  )
}
