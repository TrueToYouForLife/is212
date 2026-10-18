import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { VenueForm } from '../components/VenueForm'
import { loadLayoutOptions, loadVenueForEdit, updateVenue } from '../venueManagementService'
import { venueFormValuesFrom } from '../venueManagementValidation'
import type { FeatureOption } from '../venueFeatureCatalogue'
import type { LoadedVenue, NewVenue } from '../venueManagementValidation'

interface Loaded {
  venue: LoadedVenue
  layoutOptions: FeatureOption[]
}

function flaggedMessage(flagged: number): string {
  if (flagged === 0) return 'No existing bookings needed a review.'
  const bookings = flagged === 1 ? '1 booking' : `${flagged} bookings`
  return `${bookings} may no longer suit this venue, so their Coordinators have been asked to review them. No booking was changed.`
}

/**
 * US46 slice 2: Venue Staff edit a venue (AC-046.2). Saving checks nobody changed it meanwhile,
 * and reports how many bookings were flagged for review (AC-046.4).
 */
export function EditVenuePage() {
  const { id = '' } = useParams()
  const { profile, loading: userLoading } = useCurrentUser()
  const isVenueStaff = profile?.role === 'venue_staff'

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [saved, setSaved] = useState<{ name: string; flagged: number } | null>(null)

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoaded(null)
    setLoadError(null)
    const [venue, layouts] = await Promise.all([loadVenueForEdit(id), loadLayoutOptions()])
    if (isCancelled()) return
    if (!venue.ok) setLoadError(venue.reason)
    else if (!layouts.ok) setLoadError(layouts.reason)
    else setLoaded({ venue: venue.venue, layoutOptions: layouts.layouts })
  }, [id])

  useEffect(() => {
    if (userLoading || !isVenueStaff) return
    let cancelled = false
    void load(() => cancelled)
    return () => { cancelled = true }
  }, [userLoading, isVenueStaff, load])

  async function handleSubmit(opened: LoadedVenue, venue: NewVenue) {
    setSubmitting(true)
    setServerError(null)
    const result = await updateVenue(opened.id, opened.version, venue)
    setSubmitting(false)
    if (result.ok) {
      setSaved({ name: venue.name, flagged: result.flagged })
    } else {
      setServerError(result.reason)
      setStale(result.stale === true)
    }
  }

  function reload() {
    setServerError(null)
    setStale(false)
    setSaved(null)
    void load()
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
        <Card title="Edit a venue">
          <p className="text-sm text-slate-600">Editing venues is available to Venue Staff.</p>
        </Card>
      </PageContainer>
    )
  }

  const form = loaded ? venueFormValuesFrom(loaded.venue) : null

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <Link to="/venues/manage" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← All venues
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          {loaded ? `Edit ${loaded.venue.name}` : 'Edit a venue'}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Saving never changes an existing booking. If an edit may leave a booking unsuitable, such as
          a lower capacity or a removed layout, its Coordinator is asked to review it.
        </p>
      </div>

      {saved ? (
        <Card title="Venue updated">
          <p className="text-sm text-slate-700"><strong>{saved.name}</strong> has been saved.</p>
          <p className="mt-2 text-sm text-slate-700">{flaggedMessage(saved.flagged)}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={reload}>
              Edit again
            </button>
            <Link to="/venues/manage" className="font-semibold text-indigo-700 hover:underline">
              Back to all venues
            </Link>
          </div>
        </Card>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{loadError}</div>
      ) : !loaded || !form ? (
        <p className="text-sm text-slate-500">Loading the venue…</p>
      ) : (
        <Card title="Venue details">
          {form.dropped.length > 0 && (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {`This venue lists ${form.dropped.join(', ')}, which the catalogue no longer offers. It will be removed when you save.`}
            </p>
          )}
          {stale && (
            <button
              type="button"
              className="mb-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={reload}
            >
              Reload the venue
            </button>
          )}
          <VenueForm
            key={loaded.venue.version}
            initialValues={form.values}
            layoutOptions={loaded.layoutOptions}
            onSubmit={(venue) => void handleSubmit(loaded.venue, venue)}
            submitting={submitting}
            serverError={serverError}
            submitLabel="Save changes"
          />
        </Card>
      )}
    </PageContainer>
  )
}
