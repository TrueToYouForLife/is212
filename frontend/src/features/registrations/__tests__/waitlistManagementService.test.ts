import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  WAITLIST_MANAGEMENT_MESSAGES, loadEventWaitlist, moveWaitlistEntry,
} from '../waitlistManagementService'

/**
 * US16 SCRUM-154, service level. The database is the control (0060: assigned Coordinator, Confirmed
 * event, entry still waiting); these cases pin what the browser sends and says when it is refused.
 */
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '18100000-0000-4000-8000-000000000001'
const entryId = '18500000-0000-4000-8000-000000000001'
const fails = (code: string) => ({ data: null, error: { code, message: 'database error' } })

beforeEach(() => { vi.resetAllMocks() })

describe('AC-016.2: the Coordinator reads and reorders the waiting list', () => {
  test('AC-016.2.32: maps the list the database returns, with names and positions', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      entry_id: entryId, attendee_name: 'Ben Two', status: 'waiting', queue_position: 1,
      joined_at: '2035-04-01T01:00:00Z', offer_expires_at: null,
    }], error: null })
    expect(await loadEventWaitlist(eventId)).toEqual({
      ok: true,
      value: [{
        entryId, attendeeName: 'Ben Two', status: 'waiting', position: 1,
        joinedAt: '2035-04-01T01:00:00Z', offerExpiresAt: null,
      }],
    })
    expect(mocks.rpc).toHaveBeenCalledWith('list_event_waitlist', { p_event_id: eventId })
  })

  test('AC-016.2.33: a refusal because they are not assigned says so; any other failure is generic', async () => {
    mocks.rpc.mockResolvedValue(fails('42501'))
    expect(await loadEventWaitlist(eventId)).toEqual({ ok: false, reason: WAITLIST_MANAGEMENT_MESSAGES.notAssigned })
    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await loadEventWaitlist(eventId)).toEqual({ ok: false, reason: WAITLIST_MANAGEMENT_MESSAGES.loadFailed })
  })

  test('AC-016.2.34: sends the entry and the move, and nothing that names a person or an event', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await moveWaitlistEntry(entryId, 'front')).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('move_waitlist_entry', { p_entry_id: entryId, p_move: 'front' })
  })

  test('AC-016.2.35: a person who is no longer waiting, or an event that is not Confirmed, reloads the list', async () => {
    mocks.rpc.mockResolvedValue(fails('55000'))
    expect(await moveWaitlistEntry(entryId, 'up')).toEqual({
      ok: false, stale: true, reason: WAITLIST_MANAGEMENT_MESSAGES.notWaiting,
    })
    mocks.rpc.mockResolvedValue(fails('22000'))
    expect(await moveWaitlistEntry(entryId, 'up')).toEqual({
      ok: false, stale: true, reason: WAITLIST_MANAGEMENT_MESSAGES.notConfirmed,
    })
  })

  test('AC-016.2.36: a Coordinator who is not assigned, and any other failure, can be told and retried', async () => {
    mocks.rpc.mockResolvedValue(fails('42501'))
    expect(await moveWaitlistEntry(entryId, 'down')).toEqual({
      ok: false, stale: false, reason: WAITLIST_MANAGEMENT_MESSAGES.notAssigned,
    })
    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await moveWaitlistEntry(entryId, 'down')).toEqual({
      ok: false, stale: false, reason: WAITLIST_MANAGEMENT_MESSAGES.moveFailed,
    })
  })
})
