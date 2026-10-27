import { useState } from 'react'
import { Field } from '../../../components/ui/FormControls'
import { validateRetirementNote } from '../venueManagementValidation'

const buttonClassName =
  'rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * US46 AC-046.5: retiring a venue, with a reason and a second click to confirm, because it
 * takes the venue out of search and sends every upcoming booking's Coordinator to find another.
 */
export function RetireVenuePanel({
  venueName,
  onRetire,
  submitting,
}: {
  venueName: string
  onRetire: (note: string) => void
  submitting: boolean
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function start() {
    const result = validateRetirementNote(note)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setConfirming(true)
  }

  return (
    <section aria-labelledby="retire-venue-heading" className="rounded-xl border border-red-200 bg-red-50/40 p-5">
      <h2 id="retire-venue-heading" className="text-base font-semibold text-slate-900">Retire this venue</h2>
      <p className="mt-1 text-sm text-slate-600">
        A retired venue no longer appears in venue search and cannot take new bookings. Existing
        bookings are not cancelled: their Coordinators are asked to find another venue.
      </p>
      <div className="mt-4">
        <Field id="retirement-note" label="Why is it being retired?" error={error ?? undefined}>
          <textarea
            id="retirement-note"
            rows={2}
            value={note}
            aria-invalid={Boolean(error)}
            disabled={confirming}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </Field>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label="Confirm retirement" className="mt-4 space-y-3">
          <p className="text-sm font-medium text-red-900">
            Retire {venueName}? This cannot be undone from this page.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onRetire(note.trim())}
              className={`${buttonClassName} bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600`}
            >
              {submitting ? 'Retiring…' : 'Confirm retirement'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirming(false)}
              className={`${buttonClassName} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-indigo-600`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className={`${buttonClassName} mt-4 border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:outline-red-600`}
        >
          Retire venue…
        </button>
      )}
    </section>
  )
}
