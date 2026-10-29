import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AUDIT_MESSAGES as messages, getEventAuditTrail } from '../auditService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

const row = {
  id: 'a-1', action: 'approved', item_type: 'event', item_id: 'e-1',
  old_values: { status: 'under_review' }, new_values: { status: 'approved' },
  occurred_at: '2040-03-01T01:00:00Z', actor_id: 'u-1', actor_name: 'Casey Coordinator',
}

describe('AC-034.3 — the assigned Coordinator and the Lead see the audit records in time order', () => {
  test('AC-034.3.5: records are read in one call and keep the database order', async () => {
    mocks.rpc.mockResolvedValue({ data: [row, { ...row, id: 'a-2', actor_id: null, actor_name: null, old_values: null }], error: null })
    const result = await getEventAuditTrail('e-1')
    expect(mocks.rpc).toHaveBeenCalledWith('get_event_audit_log', { p_event_id: 'e-1' })
    expect(result).toEqual({ ok: true, entries: [
      { id: 'a-1', action: 'approved', itemType: 'event', itemId: 'e-1', oldValues: { status: 'under_review' },
        newValues: { status: 'approved' }, occurredAt: '2040-03-01T01:00:00Z', actorId: 'u-1', actorName: 'Casey Coordinator' },
      { id: 'a-2', action: 'approved', itemType: 'event', itemId: 'e-1', oldValues: null,
        newValues: { status: 'approved' }, occurredAt: '2040-03-01T01:00:00Z', actorId: null, actorName: null },
    ] })
  })

  test('AC-034.3.6: an empty answer is an empty trail; a failed or unexpected one is reported and logged', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getEventAuditTrail('e-1')).toEqual({ ok: true, entries: [] })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await getEventAuditTrail('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: 'a-1' }], error: null })
    expect(await getEventAuditTrail('e-1')).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe('AC-034.4 — Organisers and Attendees cannot view audit records', () => {
  test('AC-034.4.4: a refusal is reported as not allowed, never shown as an empty trail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' } })
    expect(await getEventAuditTrail('e-1')).toEqual({ ok: false, reason: messages.notAllowed })
    expect(console.error).not.toHaveBeenCalled()
  })
})
