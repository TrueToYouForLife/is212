import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  REVIEW_MESSAGES, getEventRequest, listEventRequests, listReviewDecisions, transitionEventStatus,
} from '../eventReviewService'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, from: mocks.from, rpc: mocks.rpc } }))

const EVENT_ID = 'c0ffee00-0000-4000-8000-000000000001'
const COORDINATOR = { role: 'coordinator' as const, isOwner: false }

/** A query chain where every step returns the chain, and awaiting it (or maybeSingle) gives `response`. */
function chain(response: unknown) {
  const q: Record<string, unknown> = {}
  for (const step of ['select', 'eq', 'neq', 'update', 'order']) q[step] = vi.fn(() => q)
  q.maybeSingle = vi.fn().mockResolvedValue(response)
  q.then = (resolve: (value: unknown) => void) => Promise.resolve(response).then(resolve)
  mocks.from.mockReturnValue(q)
  return q
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('AC-004.1 — loading requests copes with an empty or failed answer', () => {
  test('AC-004.1.10: no rows back is an empty list, not an error', async () => {
    chain({ data: null, error: null })
    expect(await listEventRequests()).toEqual({ ok: true, requests: [] })
  })

  test('AC-004.1.11: a failed load of one request says the requests could not be loaded', async () => {
    chain({ data: null, error: { message: 'connection reset' } })
    expect(await getEventRequest(EVENT_ID)).toEqual({ ok: false, reason: REVIEW_MESSAGES.loadFailed })
  })

  test('AC-004.1.12: no rows back for the decision history is an empty history', async () => {
    chain({ data: null, error: null })
    const result = await listReviewDecisions(EVENT_ID)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.decisions).toEqual([])
  })
})

describe('AC-004.2 — a refused decision explains itself', () => {
  test('AC-004.2.31: reviewing a submitted request: a permission refusal says so; any other failure is an invalid step', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } })
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'submitted', to: 'approved', actor: COORDINATOR }))
      .toEqual({ ok: false, reason: REVIEW_MESSAGES.notPermitted })
    mocks.rpc.mockResolvedValueOnce({ data: 'submitted', error: null })
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'submitted', to: 'approved', actor: COORDINATOR }))
      .toEqual({ ok: false, reason: REVIEW_MESSAGES.illegalTransition })
  })

  test('AC-004.2.32: a later step refused by a policy or the workflow trigger is "not permitted"; anything else is a load failure', async () => {
    chain({ data: null, error: { code: '42501', message: 'policy' } })
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'approved', to: 'planning', actor: COORDINATOR }))
      .toEqual({ ok: false, reason: REVIEW_MESSAGES.notPermitted })
    chain({ data: null, error: { code: '22000', message: 'trigger' } })
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'approved', to: 'planning', actor: COORDINATOR }))
      .toEqual({ ok: false, reason: REVIEW_MESSAGES.notPermitted })
    chain({ data: null, error: { code: '08006', message: 'connection lost' } })
    expect(await transitionEventStatus({ id: EVENT_ID, from: 'approved', to: 'planning', actor: COORDINATOR }))
      .toEqual({ ok: false, reason: REVIEW_MESSAGES.loadFailed })
  })
})
