import { useRef, useState } from 'react'
import { arrangementResolutionSchema } from '../arrangementReviewValidation'
import { ARRANGEMENT_RESOLUTION_MESSAGES, resolveArrangementReview } from '../arrangementReviewService'

export function ArrangementResolutionForm({ flagId, onResolved }: { flagId: string; onResolved: () => void }) {
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const submitting = useRef(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || saved) return
    if (!arrangementResolutionSchema.safeParse({ flagId, method, note }).success) {
      setError(ARRANGEMENT_RESOLUTION_MESSAGES.invalid)
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await resolveArrangementReview(flagId, method, note)
      if (result.ok) { setSaved(true); onResolved() }
      else setError(result.reason)
    } catch {
      setError(ARRANGEMENT_RESOLUTION_MESSAGES.failed)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return <form aria-label="Resolve review reason" onSubmit={submit} noValidate className="mt-3 space-y-2">
    <fieldset disabled={busy || saved} className="space-y-2 disabled:opacity-60">
      <label className="block text-sm">Resolution
        <select value={method} onChange={event => setMethod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 p-2">
          <option value="">Choose a resolution</option>
          <option value="corrected">Arrangement corrected</option>
          <option value="confirmed_valid">Still valid</option>
        </select>
      </label>
      <label className="block text-sm">Explanation
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <p className="text-xs text-slate-600">Record what you corrected or why the arrangement remains valid. Saving resolves only this reason; it does not modify the booking.</p>
      <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">{busy ? 'Saving resolution…' : 'Save resolution'}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {saved && <p role="status" className="text-sm text-green-800">Resolution saved. Refresh arrangement reviews if the history has not updated.</p>}
  </form>
}
