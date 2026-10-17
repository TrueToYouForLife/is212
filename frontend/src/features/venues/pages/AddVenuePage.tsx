import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { VenueForm } from '../components/VenueForm'
import { addVenue, loadLayoutOptions } from '../venueManagementService'
import type { FeatureOption } from '../venueFeatureCatalogue'
import type { NewVenue } from '../venueManagementValidation'

/**
 * US46 slice 1: Venue Staff add a venue (AC-046.1, AC-046.3). Behind
 * VITE_FEATURE_VENUE_MANAGEMENT until editing and retiring are built too.
 */
export function AddVenuePage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const isVenueStaff = profile?.role === 'venue_staff'

  const [layoutOptions, setLayoutOptions] = useState<FeatureOption[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  // A new key gives "Add another venue" a fresh, empty form.
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (userLoading || !isVenueStaff) return
    let cancelled = false
    void loadLayoutOptions().then((result) => {
      if (cancelled) return
      if (result.ok) setLayoutOptions(result.layouts)
      else setLoadError(result.reason)
    })
    return () => { cancelled = true }
  }, [userLoading, isVenueStaff])

  async function handleSubmit(venue: NewVenue) {
    setSubmitting(true)
    setServerError(null)
    const result = await addVenue(venue)
    setSubmitting(false)
    if (result.ok) setAdded(venue.name)
    else setServerError(result.reason)
  }

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
        <Card title="Add a venue">
          <p className="text-sm text-slate-600">Adding venues is available to Venue Staff.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add a venue</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Coordinators search and book from these details, so enter each layout the venue supports
          with its capacity in that layout.
        </p>
      </div>

      {added ? (
        <Card title="Venue added">
          <p className="text-sm text-slate-700">
            <strong>{added}</strong> is now in the venue catalogue.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button
              type="button"
              className="font-semibold text-indigo-700 hover:underline"
              onClick={() => { setAdded(null); setFormKey((key) => key + 1) }}
            >
              Add another venue
            </button>
            <Link to="/venues/availability" className="font-semibold text-indigo-700 hover:underline">
              View venue availability
            </Link>
          </div>
        </Card>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {loadError}
        </div>
      ) : !layoutOptions ? (
        <p className="text-sm text-slate-500">Loading layout options…</p>
      ) : (
        <Card title="Venue details">
          <VenueForm
            key={formKey}
            layoutOptions={layoutOptions}
            onSubmit={(venue) => void handleSubmit(venue)}
            submitting={submitting}
            serverError={serverError}
            submitLabel="Add venue"
          />
        </Card>
      )}
    </PageContainer>
  )
}
