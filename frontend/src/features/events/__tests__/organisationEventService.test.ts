import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ORGANISATION_EVENT_MESSAGES as messages,
  loadOrganisationEvent,
  loadOrganisationEvents,
} from '../organisationEventService'

/**
 * US31 slice 2 — the service half of AC-031.1 to AC-031.3 (SCRUM-228).
 *
 * These are mocked: they check that this module asks 0078 for the right thing and maps
 * what comes back faithfully. Whether the database actually withholds another client's
 * events is settled in organisation_event_access.sql against real RLS — a mocked test
 * could only prove this file trusts whatever it is handed.
 */

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const MINE = 'c0ffee00-0000-4000-8000-000000000001'
const THEIRS = 'c0ffee00-0000-4000-8000-000000000002'

const mineRow = {
  id: MINE,
  reference: 'EVT-2046-001',
  name: 'Northwind Kickoff',
  status: 'approved',
  proposed_start: '2046-06-01T02:00:00Z',
  proposed_end: '2046-06-01T04:00:00Z',
  organiser_name: 'Ama One',
  is_mine: true,
}

const colleagueRow = {
  ...mineRow,
  id: THEIRS,
  reference: 'EVT-2046-002',
  name: 'Northwind Awards',
  status: 'submitted',
  organiser_name: 'Ada Two',
  is_mine: false,
}

const detailRow = {
  ...colleagueRow,
  purpose: 'Recognise the delivery team',
  event_type: 'Awards dinner',
  expected_attendance: 120,
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-031.1 — an Organiser can view and act on their own events', () => {
  test('AC-031.1.4: the caller’s own events come back marked as theirs', async () => {
    mocks.rpc.mockResolvedValue({ data: [mineRow], error: null })
    const result = await loadOrganisationEvents()

    expect(mocks.rpc).toHaveBeenCalledWith('list_organisation_events')
    expect(result).toEqual({
      ok: true,
      value: [{
        id: MINE,
        reference: 'EVT-2046-001',
        name: 'Northwind Kickoff',
        status: 'approved',
        statusLabel: 'Approved',
        proposedStart: '2046-06-01T02:00:00Z',
        proposedEnd: '2046-06-01T04:00:00Z',
        organiserName: 'Ama One',
        isMine: true,
      }],
    })
  })

  // The defect US42 hit (AC-042.1.4): a failed read that returns an empty success shows
  // "no events yet" to someone whose colleagues have plenty, and nothing looks broken.
  test('AC-031.1.5: a read error is reported, not flattened into an empty list', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await loadOrganisationEvents()).toEqual({ ok: false, reason: messages.loadFailed })
  })
})

describe('AC-031.2 — colleagues may view, and only view', () => {
  test('AC-031.2.9: a colleague’s event is not claimed as the caller’s own', async () => {
    mocks.rpc.mockResolvedValue({ data: [colleagueRow], error: null })
    const result = await loadOrganisationEvents()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0].isMine).toBe(false)
    expect(result.value[0].organiserName).toBe('Ada Two')
  })

  // A colleague sees "In review", never "Clarification required": 0078 withholds
  // review_note, so what the coordinator asked the owner to clarify stays between them.
  // This pins the mapper to that, so restoring the note later is a deliberate act.
  test('AC-031.2.10: a submitted event reads as In review to a colleague', async () => {
    mocks.rpc.mockResolvedValue({ data: [colleagueRow], error: null })
    const result = await loadOrganisationEvents()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0].statusLabel).toBe('In review')
  })

  test('AC-031.2.11: the mapped event exposes only the agreed fields', async () => {
    mocks.rpc.mockResolvedValue({ data: [detailRow], error: null })
    const result = await loadOrganisationEvent(THEIRS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // A closed list on purpose, the same instinct as AC-004.2.14: adding a field to the
    // projection should break a test rather than quietly reach a colleague's screen.
    expect(Object.keys(result.value).sort()).toEqual([
      'eventType', 'expectedAttendance', 'id', 'isMine', 'name', 'organiserName',
      'proposedEnd', 'proposedStart', 'purpose', 'reference', 'status', 'statusLabel',
    ])
  })

  test('AC-031.2.12: an organisation with no shared events is a success, not a failure', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await loadOrganisationEvents()).toEqual({ ok: true, value: [] })
  })
})

describe('AC-031.3 — nothing from another client organisation', () => {
  // 0078 returns no row for another organisation's event, a draft, or an id that does not
  // exist, and does not say which. The service repeats that silence.
  test('AC-031.3.9: a direct link to another organisation’s event is simply not found', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await loadOrganisationEvent(THEIRS))
      .toEqual({ ok: false, reason: messages.notFound })
  })

  test('AC-031.3.10: an id that cannot be a uuid is refused before any query runs', async () => {
    expect(await loadOrganisationEvent('not-a-uuid'))
      .toEqual({ ok: false, reason: messages.notFound })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-031.3.11: a failed single-event read is reported as a failure, not as not-found', async () => {
    // Boundary between the two refusals: "could not load" invites a retry, "not found"
    // does not, so collapsing them would send someone back to a page that will never work.
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await loadOrganisationEvent(MINE))
      .toEqual({ ok: false, reason: messages.loadFailed })
  })

  test('AC-031.3.12: the single-event read passes the id the caller asked for', async () => {
    mocks.rpc.mockResolvedValue({ data: [detailRow], error: null })
    await loadOrganisationEvent(THEIRS)
    expect(mocks.rpc).toHaveBeenCalledWith('get_organisation_event', { p_event_id: THEIRS })
  })
})
