import { useEffect, useRef, useState } from 'react'
import { ClarificationResponseFields } from './ClarificationResponseFields'
import {
  CLARIFICATION_SERVICE_MESSAGES,
  sendClarificationResponse,
} from '../clarificationResponseService'
import { isAwaitingClarification } from '../clarificationResponseValidation'
import type { ClarificationValues } from '../clarificationResponseValidation'
import { loadRequirementCatalogue } from '../requirementCatalogueService'
import { EMPTY_REQUIREMENT_CATALOGUE } from '../requirementCatalogue'
import type { RequirementCatalogue } from '../requirementCatalogue'
import type { EventRequestDetail } from '../types'

/**
 * US37 AC-037.1 and AC-037.2 (SCRUM-234): the Organiser answers the question and resubmits.
 *
 * Rendered only for a returned request, by the same test organiserStatusLabel uses to show
 * "Clarification required" — so the form and the badge can never disagree about whether
 * there is a question outstanding. Hiding it is the courtesy; 0096 is the control, and it
 * refuses an answer to a request that is not awaiting one whatever the screen does.
 *
 * Seeded from the request as displayed, so the Organiser edits what the Coordinator saw.
 * The service sends only what actually changed.
 */
function initialValues(request: EventRequestDetail): ClarificationValues {
  return {
    name: request.name, purpose: request.purpose, eventType: request.eventType,
    description: request.description, programme: request.programme,
    proposedStart: request.proposedStart, proposedEnd: request.proposedEnd,
    expectedAttendance: request.expectedAttendance,
    layoutPreference: request.layoutPreference,
    accessibilityRequirements: request.accessibilityRequirements,
    facilityRequirements: request.facilityRequirements,
    equipmentRequirements: request.equipmentRequirements,
    registrationRequired: request.registrationRequired,
    specialArrangements: request.specialArrangements,
  }
}

export function ClarificationResponseForm({ request, onSent }: {
  request: EventRequestDetail
  onSent: () => void
}) {
  const [values, setValues] = useState<ClarificationValues>(() => initialValues(request))
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<RequirementCatalogue>(EMPTY_REQUIREMENT_CATALOGUE)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(false)
  const sending = useRef(false)
  const awaiting = isAwaitingClarification(request)

  useEffect(() => {
    // Hooks run before the early return below, so without this the catalogue would be
    // fetched for every request detail page an Organiser opens, almost none of which has a
    // question outstanding.
    if (!awaiting) return
    let active = true
    loadRequirementCatalogue().then((result) => {
      if (!active) return
      setCatalogue(result.catalogue)
      setCatalogueError(result.ok ? null : result.reason)
    })
    return () => { active = false }
  }, [awaiting])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || locked) return
    sending.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await sendClarificationResponse(request, { reply, values })
      if (result.ok) {
        // Locked on success so a second click cannot send the same answer again: the
        // request is already back under review and the retry would be refused as
        // not-awaiting-clarification, which reads as a bug rather than a duplicate.
        setLocked(true)
        onSent()
      } else {
        setError(result.reason)
        // A reload is the only way forward for these two, so the form stops accepting
        // instead of inviting a retry that cannot succeed. Everything else — a blank
        // reply, an invalid date — is worth fixing in place.
        if (result.reason === CLARIFICATION_SERVICE_MESSAGES.reload
          || result.reason === CLARIFICATION_SERVICE_MESSAGES.failed) setLocked(true)
      }
    } catch {
      setLocked(true)
      setError(CLARIFICATION_SERVICE_MESSAGES.failed)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  if (!awaiting) return null

  return <form aria-label="Answer the clarification request" onSubmit={submit} noValidate
    className="space-y-4">
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">The coordinator asked:</p>
      <p className="mt-1 whitespace-pre-line text-sm text-amber-900">{request.reviewNote}</p>
    </div>

    {catalogueError && <p role="status" className="text-sm text-amber-800">{catalogueError}</p>}

    <label className="block text-sm">
      Your reply
      <textarea value={reply} rows={4} disabled={busy || locked}
        onChange={(event) => setReply(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
    </label>

    <details className="rounded-lg border border-slate-200 p-3">
      {/* Collapsed by default. Most answers are a reply and one corrected field, and
          fourteen inputs between the question and the send button buries both. */}
      <summary className="cursor-pointer text-sm font-medium text-slate-700">
        Revise the request details
      </summary>
      <div className="mt-4">
        <ClarificationResponseFields values={values} catalogue={catalogue}
          disabled={busy || locked}
          onChange={(patch) => setValues((previous) => ({ ...previous, ...patch }))} />
      </div>
    </details>

    <p className="text-sm text-slate-600">
      Sending your reply puts the request back under review with the same reference. Only the
      details you actually change are recorded as revisions.
    </p>

    <button type="submit" disabled={busy || locked}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {busy ? 'Sending reply…' : 'Send reply and resubmit'}
    </button>

    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>
}
