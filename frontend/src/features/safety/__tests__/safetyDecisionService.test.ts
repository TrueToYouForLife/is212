import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SAFETY_FACTORS, emptyDecisionForm } from '../safetyDecision'
import type { SafetyDecisionForm } from '../safetyDecision'
import { SAFETY_DECISION_MESSAGES as messages, getSafetyReviewDecisions, recordSafetyReviewDecision } from '../safetyDecisionService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

function form(change: Partial<SafetyDecisionForm>): SafetyDecisionForm {
  const base = emptyDecisionForm()
  for (const factor of SAFETY_FACTORS) base.assessments[factor.code] = { concern: false, note: '' }
  base.assessments.crowd_movement = { concern: true, note: ' One way in ' }
  return { ...base, ...change }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-044.2 — the decision is recorded once, with every factor', () => {
  test('AC-044.2.4: one call carries the decision, the trimmed comment, what to revisit and all seven factors; an approval sends nothing to revisit', async () => {
    mocks.rpc.mockResolvedValue({ data: 'safety_changes_requested', error: null })
    expect(await recordSafetyReviewDecision('e-1', form({ decision: 'request_changes', comment: ' Move it ', revisit: ['venue'] })))
      .toEqual({ ok: true, status: 'safety_changes_requested' })
    const [name, args] = mocks.rpc.mock.calls[0]
    expect(name).toBe('record_safety_review_decision')
    expect(args).toMatchObject({ p_event_id: 'e-1', p_decision: 'request_changes', p_comment: 'Move it', p_revisit: ['venue'] })
    expect(args.p_assessments).toHaveLength(7)
    expect(args.p_assessments[5]).toEqual({ factor: 'crowd_movement', concern: true, note: 'One way in' })
    expect(args.p_assessments[0]).toEqual({ factor: 'attendance', concern: false, note: null })
    await recordSafetyReviewDecision('e-1', form({ decision: 'approve', comment: ' ', revisit: ['venue'] }))
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_decision: 'approve', p_comment: null, p_revisit: [] })
  })
})

describe('AC-044.6 — only Safety Officers decide', () => {
  test('AC-044.6.4: each refusal says why; a rule the database rejects is shown as it explains it', async () => {
    for (const [code, reason] of [['42501', messages.notSafetyOfficer], ['22000', messages.notAwaiting], ['0A000', messages.notSwitchedOn],
      ['22023', 'Assess every factor once'], ['08006', messages.failed]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: code === '22023' ? 'Assess every factor once' : 'x' } })
      expect(await recordSafetyReviewDecision('e-1', form({ decision: 'approve' }))).toEqual({ ok: false, reason })
    }
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})

describe('AC-044.5 — the Coordinator sees the decisions', () => {
  test('AC-044.5.3: the decisions are read for the event and named for the app; refusals and odd answers say so', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ decision_id: 'd-1', decision: 'reject', comment: 'Too small', revisit: ['venue'],
      decided_at: '2043-01-11T01:00:00Z', decided_by_name: 'Sam', assessments: [{ factor: 'attendance', concern: true, note: 'Over' }] }], error: null })
    expect(await getSafetyReviewDecisions('e-1')).toEqual({ ok: true, decisions: [{ decisionId: 'd-1', decision: 'reject', comment: 'Too small',
      revisit: ['venue'], decidedAt: '2043-01-11T01:00:00Z', decidedByName: 'Sam', assessments: [{ factor: 'attendance', concern: true, note: 'Over' }] }] })
    expect(mocks.rpc).toHaveBeenCalledWith('get_safety_review_decisions', { p_event_id: 'e-1' })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'x' } })
    expect(await getSafetyReviewDecisions('e-1')).toEqual({ ok: false, reason: messages.notAllowed })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'x' } })
    expect(await getSafetyReviewDecisions('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ decision_id: 'd-1', decision: 'maybe' }], error: null })
    expect(await getSafetyReviewDecisions('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getSafetyReviewDecisions('e-1')).toEqual({ ok: true, decisions: [] })
  })
})
