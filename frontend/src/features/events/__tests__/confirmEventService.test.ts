import { beforeEach, describe, expect, test, vi } from 'vitest'
import { REVIEW_MESSAGES, transitionEventStatus } from '../eventReviewService'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth: {}, from: mocks.from } }))

function mockUpdate(response: { data: unknown; error: { code?: string; message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(response)
  const select = vi.fn(() => ({ maybeSingle }))
  const eqStatus = vi.fn(() => ({ select }))
  const eqId = vi.fn(() => ({ eq: eqStatus }))
  const update = vi.fn(() => ({ eq: eqId }))
  mocks.from.mockReturnValue({ update })
  return { update }
}

beforeEach(() => mocks.from.mockReset())

describe('AC-026.1 — confirmed only once every essential arrangement is complete', () => {
  test('AC-026.1.5: when the database refuses because the event is not ready, the Coordinator is told exactly that', async () => {
    const { update } = mockUpdate({ data: null, error: { code: '55000', message: 'not ready' } })
    const result = await transitionEventStatus({
      id: 'event-1', from: 'planning', to: 'confirmed', actor: { role: 'coordinator', isOwner: false },
    })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }))
    expect(result).toEqual({ ok: false, reason: REVIEW_MESSAGES.notReady })
  })
})
