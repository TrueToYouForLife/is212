import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { SAFETY_FACTORS, emptyDecisionForm, validateDecisionForm } from './safetyDecision'
import type { RevisitArea, SafetyDecisionForm, SafetyDecisionKind, SafetyFactor } from './safetyDecision'
import { recordSafetyReviewDecision } from './safetyDecisionService'

const DECISION_OPTIONS: { value: SafetyDecisionKind; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'request_changes', label: 'Request changes' },
  { value: 'reject', label: 'Reject' },
]
const REVISIT_OPTIONS: { value: RevisitArea; label: string }[] = [
  { value: 'venue', label: 'Venue' },
  { value: 'equipment', label: 'Equipment' },
]

/**
 * US44 AC-044.1 to AC-044.4: the Safety Officer assesses each factor and records one decision.
 * The database (0111) applies the same rules; the form says what is missing first.
 */
export function SafetyReviewDecisionForm({ eventId, onDecided }: {
  eventId: string
  onDecided: (decision: SafetyDecisionKind) => void
}) {
  const [form, setForm] = useState<SafetyDecisionForm>(emptyDecisionForm)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function setAnswer(factor: SafetyFactor, change: Partial<SafetyDecisionForm['assessments'][SafetyFactor]>) {
    setForm((current) => ({
      ...current,
      assessments: { ...current.assessments, [factor]: { ...current.assessments[factor], ...change } },
    }))
  }

  function toggleRevisit(area: RevisitArea) {
    setForm((current) => ({
      ...current,
      revisit: current.revisit.includes(area) ? current.revisit.filter((item) => item !== area) : [...current.revisit, area],
    }))
  }

  async function submit() {
    const problems = validateDecisionForm(form)
    setErrors(problems)
    if (problems.length > 0) return
    setSaving(true)
    const result = await recordSafetyReviewDecision(eventId, form)
    setSaving(false)
    if (result.ok && form.decision) onDecided(form.decision)
    else if (!result.ok) setErrors([result.reason])
  }

  const needsReasons = form.decision !== null && form.decision !== 'approve'

  return (
    <form
      aria-label="Safety review decision"
      className="mt-4 space-y-4 border-t border-slate-200 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {SAFETY_FACTORS.map((factor) => {
        const answer = form.assessments[factor.code]
        return (
          <fieldset key={factor.code} className="rounded border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">{factor.label}</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input type="radio" name={`${eventId}-${factor.code}`} checked={answer.concern === false}
                  onChange={() => setAnswer(factor.code, { concern: false })} />
                No concern
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name={`${eventId}-${factor.code}`} checked={answer.concern === true}
                  onChange={() => setAnswer(factor.code, { concern: true })} />
                Concern
              </label>
            </div>
            <label className="mt-2 block text-sm">
              <span className="text-slate-600">Note for {factor.label}{answer.concern ? ' (required)' : ''}</span>
              <textarea className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm" rows={2}
                value={answer.note} onChange={(event) => setAnswer(factor.code, { note: event.target.value })} />
            </label>
          </fieldset>
        )
      })}

      <fieldset className="text-sm">
        <legend className="font-medium text-slate-800">Decision</legend>
        <div className="mt-1 flex gap-4">
          {DECISION_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1">
              <input type="radio" name={`${eventId}-decision`} checked={form.decision === option.value}
                onChange={() => setForm((current) => ({ ...current, decision: option.value }))} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-slate-600">Comment{needsReasons ? ' (required)' : ''}</span>
        <textarea className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm" rows={3}
          value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} />
      </label>

      {needsReasons && (
        <fieldset className="text-sm">
          <legend className="font-medium text-slate-800">Revisit</legend>
          <div className="mt-1 flex gap-4">
            {REVISIT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-1">
                <input type="checkbox" checked={form.revisit.includes(option.value)} onChange={() => toggleRevisit(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-sm text-red-700">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record decision'}</Button>
    </form>
  )
}
