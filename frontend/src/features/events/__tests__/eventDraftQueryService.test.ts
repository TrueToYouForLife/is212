import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DRAFT_LOAD_MESSAGES, getEventDraft, listEventDrafts } from '../eventDraftQueryService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const row = {
  id: 'draft-1', organiser_id: 'organiser-1', status: 'draft', updated_at: '2026-09-17T10:00:00Z',
  name: 'Team dinner', purpose: 'Celebrate', event_type: 'Dinner', description: 'Team meal',
  proposed_start: '2030-01-01T10:00:00Z', proposed_end: '2030-01-01T12:00:00Z',
  expected_attendance: 25, programme: 'Welcome', layout_preference: 'Banquet',
  accessibility_requirements: 'Ramp', equipment_requirements: 'Microphone',
  registration_required: true, special_arrangements: 'Vegetarian meals',
}

function mockRead(data: Record<string, unknown> | null = row, error: object | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn(), update: vi.fn(),
  }
  mocks.from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'organiser-1' } }, error: null })
})

function mockList(data: Record<string, unknown>[] | null, error: object | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  }
  mocks.from.mockReturnValue(query)
  return query
}

describe('AC-001.4', () => {
  test("AC-001.4.3: loads every saved field without writing or submitting (also AC-001.5)", async () => {
    const query = mockRead()
    expect(await getEventDraft('draft-1')).toEqual({
      ok: true,
      draft: {
        id: row.id, status: 'draft', updatedAt: row.updated_at,
        values: {
          name: 'Team dinner', purpose: 'Celebrate', eventType: 'Dinner', description: 'Team meal',
          proposedStart: row.proposed_start, proposedEnd: row.proposed_end, expectedAttendance: 25,
          programme: 'Welcome', layoutPreference: 'Banquet', accessibilityRequirements: 'Ramp',
          equipmentRequirements: 'Microphone', registrationRequired: true, specialArrangements: 'Vegetarian meals',
        },
      },
    })
    expect(mocks.from).toHaveBeenCalledWith('events')
    expect(query.eq.mock.calls).toEqual([
      ['id', 'draft-1'], ['organiser_id', 'organiser-1'], ['status', 'draft'],
    ])
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.update).not.toHaveBeenCalled()
  })

  test("AC-001.4.4: loads an incomplete draft without applying submission validation (also AC-001.2)", async () => {
    const fields = Object.fromEntries(Object.keys(row).map((key) => [key, null]))
    mockRead({ ...fields, id: row.id, organiser_id: row.organiser_id, status: 'draft', updated_at: row.updated_at })
    const result = await getEventDraft('draft-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.values).toEqual({
      name: '', purpose: '', eventType: '', description: '', proposedStart: '', proposedEnd: '',
      expectedAttendance: '', programme: '', layoutPreference: '', accessibilityRequirements: '',
      equipmentRequirements: '', registrationRequired: false, specialArrangements: '',
    })
  })

  test.each([
    ['AC-001.4.5', null],
    ['AC-001.4.6', { ...row, status: 'submitted' }],
    ['AC-001.4.7', { ...row, organiser_id: 'someone-else' }],
    ['AC-001.4.8', { ...row, id: 'different' }],
  ] as const)(
    "%s: does not expose an unavailable or mismatched draft (%j)", async (_caseId, data) => {
      mockRead(data)
      expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.unavailable })
    },
  )

  test("AC-001.4.9: rejects an empty ID without contacting Supabase", async () => {
    expect(await getEventDraft(' ')).toMatchObject({ ok: false })
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    ['AC-001.4.10', { data: { user: null }, error: null }],
    ['AC-001.4.11', { data: { user: { id: 'organiser-1' } }, error: { message: 'Expired session' } }],
  ] as const)("%s: requires a valid signed-in user (%j)", async (_caseId, session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test("AC-001.4.12: reports a database failure without exposing internal details", async () => {
    mockRead(null, { message: 'private schema details' })
    expect(await getEventDraft('draft-1')).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed })
  })

  test("AC-001.4.13: handles a lost database connection", async () => {
    const query = mockRead()
    query.maybeSingle.mockRejectedValue(new Error('Offline'))
    await expect(getEventDraft('draft-1')).resolves.toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.loadFailed })
  })

  test("AC-001.4.14: handles an authentication exception without querying events", async () => {
    mocks.getUser.mockRejectedValue(new Error('Offline'))
    await expect(getEventDraft('draft-1')).resolves.toMatchObject({ ok: false })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test("AC-001.4.15: requests only owned drafts ordered by most recently saved (also AC-001.3)", async () => {
    const query = mockList([row])
    expect(await listEventDrafts()).toEqual({ ok: true, drafts: [{
      id: row.id, status: 'draft', updatedAt: row.updated_at, name: row.name, purpose: row.purpose,
    }] })
    expect(query.eq.mock.calls).toEqual([['organiser_id', 'organiser-1'], ['status', 'draft']])
    expect(query.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  test("AC-001.4.16: filters mismatched rows without exposing them (also AC-001.3)", async () => {
    mockList([{ ...row, organiser_id: 'other' }, { ...row, status: 'submitted' }])
    expect(await listEventDrafts()).toEqual({ ok: true, drafts: [] })
  })

  test("AC-001.4.17: an empty list is successful rather than an error", async () => {
    mockList([])
    expect(await listEventDrafts()).toEqual({ ok: true, drafts: [] })
  })

  test("AC-001.4.18: signed-out users cannot query drafts", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await listEventDrafts()).toMatchObject({ ok: false, reason: DRAFT_LOAD_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test("AC-001.4.19: reports a failed query without pretending the list is empty", async () => {
    mockList(null, { message: 'Internal details' })
    expect(await listEventDrafts()).toEqual({ ok: false, reason: DRAFT_LOAD_MESSAGES.listFailed })
  })

  test("AC-001.4.20: handles connection exceptions", async () => {
    mockList([]).order.mockRejectedValue(new Error('Offline'))
    await expect(listEventDrafts()).resolves.toMatchObject({ ok: false })
  })
})
