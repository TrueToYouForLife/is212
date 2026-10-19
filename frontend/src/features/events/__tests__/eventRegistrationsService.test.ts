import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  EVENT_REGISTRATIONS_MESSAGES as messages,
  loadEventRegistrations,
} from '../eventRegistrationsService'

/**
 * US54 — the service half of AC-054.1 to AC-054.4 (SCRUM-246).
 *
 * Mocked: these check what this module asks 0094 for and how it maps the answer. Who may
 * actually see a roll call is settled in event_registration_visibility.sql against real
 * RLS; a mocked test could only prove this file trusts whatever it is handed.
 */

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

const activeRow = {
  id: 'c0ffee00-0000-4000-8000-00000000aaa1',
  attendee_name: 'Ada Attendee',
  attendee_email: 'ada@example.test',
  status: 'registered',
  registered_at: '2046-09-01T02:00:00Z',
  withdrawn_at: null,
}

const withdrawnRow = {
  ...activeRow,
  id: 'c0ffee00-0000-4000-8000-00000000aaa2',
  attendee_name: 'Ben Attendee',
  attendee_email: 'ben@example.test',
  status: 'withdrawn',
  withdrawn_at: '2046-09-03T02:00:00Z',
}

/** The list call, then the permission call the service makes only on an empty list. */
function stub(list: unknown, permitted?: unknown) {
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValueOnce(list)
  if (permitted !== undefined) mocks.rpc.mockResolvedValueOnce(permitted)
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-054.1 — the Organiser sees each registration with the attendee’s details', () => {
  test('AC-054.1.6: each row is mapped with name, email, status and registration date', async () => {
    stub({ data: [activeRow], error: null })
    const result = await loadEventRegistrations(EVENT)

    expect(mocks.rpc).toHaveBeenCalledWith('list_event_registrations', { p_event_id: EVENT })
    expect(result).toEqual({
      ok: true,
      value: {
        activeCount: 1,
        registrations: [{
          id: 'c0ffee00-0000-4000-8000-00000000aaa1',
          attendeeName: 'Ada Attendee',
          attendeeEmail: 'ada@example.test',
          status: 'registered',
          registeredAt: '2046-09-01T02:00:00Z',
          withdrawnAt: null,
        }],
      },
    })
  })

  test('AC-054.1.7: a read error is reported, not flattened into an empty roll call', async () => {
    // The US42 defect (AC-042.1.4): a failed read returning an empty success tells the
    // Organiser nobody is coming, which is a worse answer than an error.
    stub({ data: null, error: { message: 'boom' } })
    expect(await loadEventRegistrations(EVENT))
      .toEqual({ ok: false, reason: messages.loadFailed })
  })

  test('AC-054.1.8: an id that cannot be a uuid is refused before any query runs', async () => {
    expect(await loadEventRegistrations('not-a-uuid'))
      .toEqual({ ok: false, reason: messages.notPermitted })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('AC-054.2 — withdrawn registrations are marked and not counted', () => {
  test('AC-054.2.4: a withdrawn row is kept, marked, and left out of the active count', async () => {
    stub({ data: [activeRow, withdrawnRow], error: null })
    const result = await loadEventRegistrations(EVENT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.registrations).toHaveLength(2)
    expect(result.value.activeCount).toBe(1)
    expect(result.value.registrations[1]).toMatchObject({
      status: 'withdrawn', withdrawnAt: '2046-09-03T02:00:00Z',
    })
  })

  test('AC-054.2.5: an event everyone withdrew from counts zero without being empty', async () => {
    // Boundary: no active registrations is not the same as no registrations, and the page
    // needs both facts to say "0 going" rather than "nobody has registered yet".
    stub({ data: [withdrawnRow], error: null })
    const result = await loadEventRegistrations(EVENT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.activeCount).toBe(0)
    expect(result.value.registrations).toHaveLength(1)
  })

  test('AC-054.2.6: the order the database returned is preserved', async () => {
    // 0094 orders active first, then most recent. Re-sorting here would put the list and
    // the database's intent out of step for no reason.
    stub({ data: [activeRow, withdrawnRow], error: null })
    const result = await loadEventRegistrations(EVENT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.registrations.map((r) => r.status)).toEqual(['registered', 'withdrawn'])
  })
})

describe('AC-054.4 — an empty answer is resolved, not guessed', () => {
  test('AC-054.4.7: an event nobody has registered for is an empty success', async () => {
    stub({ data: [], error: null }, { data: true, error: null })
    expect(await loadEventRegistrations(EVENT))
      .toEqual({ ok: true, value: { registrations: [], activeCount: 0 } })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'can_view_event_registrations',
      { p_event_id: EVENT })
  })

  test('AC-054.4.8: a caller who may not look is told so, not shown an empty event', async () => {
    stub({ data: [], error: null }, { data: false, error: null })
    expect(await loadEventRegistrations(EVENT))
      .toEqual({ ok: false, reason: messages.notPermitted })
  })

  // The extra round trip is the price of telling those two apart, so it is only paid when
  // there is something to tell apart. A populated list is already proof of access.
  test('AC-054.4.9: a populated list costs one call, not two', async () => {
    stub({ data: [activeRow], error: null })
    await loadEventRegistrations(EVENT)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-054.4.10: a failed permission check is a load failure, not a refusal', async () => {
    // Boundary between the two: "could not load" invites a retry, "not permitted" does
    // not. Reporting a broken connection as a refusal would send someone away for good.
    stub({ data: [], error: null }, { data: null, error: { message: 'boom' } })
    expect(await loadEventRegistrations(EVENT))
      .toEqual({ ok: false, reason: messages.loadFailed })
  })
})
