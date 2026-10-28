/** US44: the factors the Safety Officer assesses, in order (0111's safety_review_factors()). */
export const SAFETY_FACTORS = [
  { code: 'attendance', label: 'Attendance' },
  { code: 'venue_capacity_layout', label: 'Venue capacity and layout' },
  { code: 'emergency_access', label: 'Emergency access' },
  { code: 'accessibility', label: 'Accessibility' },
  { code: 'equipment_placement', label: 'Equipment placement' },
  { code: 'crowd_movement', label: 'Crowd movement' },
  { code: 'venue_restrictions', label: 'Venue restrictions' },
] as const

export type SafetyFactor = (typeof SAFETY_FACTORS)[number]['code']
export type SafetyDecisionKind = 'approve' | 'request_changes' | 'reject'
export type RevisitArea = 'venue' | 'equipment'

export const DECISION_LABELS: Record<SafetyDecisionKind, string> = {
  approve: 'Approved',
  request_changes: 'Changes requested',
  reject: 'Rejected',
}

export function factorLabel(code: string): string {
  return SAFETY_FACTORS.find((factor) => factor.code === code)?.label ?? code
}

export interface FactorAnswer {
  concern: boolean | null
  note: string
}

export interface SafetyDecisionForm {
  assessments: Record<SafetyFactor, FactorAnswer>
  decision: SafetyDecisionKind | null
  comment: string
  revisit: RevisitArea[]
}

export function emptyDecisionForm(): SafetyDecisionForm {
  const assessments = Object.fromEntries(
    SAFETY_FACTORS.map((factor) => [factor.code, { concern: null, note: '' }]),
  ) as Record<SafetyFactor, FactorAnswer>
  return { assessments, decision: null, comment: '', revisit: [] }
}

/**
 * PURE — AC-044.1, AC-044.2, AC-044.4: the same rules 0111 enforces, so the form says what is
 * missing before anything is sent. Returns one message per problem; empty when ready.
 */
export function validateDecisionForm(form: SafetyDecisionForm): string[] {
  const errors: string[] = []
  for (const factor of SAFETY_FACTORS) {
    const answer = form.assessments[factor.code]
    if (answer.concern === null) errors.push(`Choose concern or no concern for ${factor.label}.`)
    else if (answer.concern && !answer.note.trim()) errors.push(`Describe the concern for ${factor.label}.`)
  }
  if (!form.decision) {
    errors.push('Choose Approve, Request changes or Reject.')
  } else if (form.decision !== 'approve') {
    if (!form.comment.trim()) errors.push('Add a comment explaining the decision.')
    if (form.revisit.length === 0) errors.push('Choose what to revisit: venue, equipment or both.')
  }
  return errors
}
