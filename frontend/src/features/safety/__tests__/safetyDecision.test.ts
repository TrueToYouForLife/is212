import { describe, expect, test } from 'vitest'
import { SAFETY_FACTORS, emptyDecisionForm, factorLabel, validateDecisionForm } from '../safetyDecision'
import type { SafetyDecisionForm } from '../safetyDecision'

function allNoConcern(): SafetyDecisionForm {
  const form = emptyDecisionForm()
  for (const factor of SAFETY_FACTORS) form.assessments[factor.code] = { concern: false, note: '' }
  return form
}

describe('AC-044.1 — every factor is assessed', () => {
  test('AC-044.1.3: each of the seven factors needs concern or no concern, and every concern needs a note', () => {
    const blank = validateDecisionForm({ ...emptyDecisionForm(), decision: 'approve' })
    expect(blank).toHaveLength(7)
    expect(blank[0]).toBe('Choose concern or no concern for Attendance.')
    const form = allNoConcern()
    form.assessments.emergency_access = { concern: true, note: '  ' }
    expect(validateDecisionForm({ ...form, decision: 'approve' })).toEqual(['Describe the concern for Emergency access.'])
    form.assessments.emergency_access = { concern: true, note: 'Exit blocked' }
    expect(validateDecisionForm({ ...form, decision: 'approve' })).toEqual([])
    expect(factorLabel('crowd_movement')).toBe('Crowd movement')
    expect(factorLabel('unknown')).toBe('unknown')
  })
})

describe('AC-044.2 — one decision, with reasons when it is not an approval', () => {
  test('AC-044.2.3: a decision is required; Request changes and Reject need a comment and something to revisit', () => {
    expect(validateDecisionForm(allNoConcern())).toEqual(['Choose Approve, Request changes or Reject.'])
    expect(validateDecisionForm({ ...allNoConcern(), decision: 'reject', comment: ' ' })).toEqual([
      'Add a comment explaining the decision.',
      'Choose what to revisit: venue, equipment or both.',
    ])
    expect(validateDecisionForm({ ...allNoConcern(), decision: 'request_changes', comment: 'Move the stage', revisit: ['venue'] })).toEqual([])
    expect(validateDecisionForm({ ...allNoConcern(), decision: 'approve' })).toEqual([])
  })
})
