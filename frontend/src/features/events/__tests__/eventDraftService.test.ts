import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DRAFT_MESSAGES, saveEventDraft } from '../eventDraftService'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const ORGANISER_ID = '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11'

const savedRow = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  status: 'draft',
  updated_at: '2026-09-17T10:00:00Z',
}

function mockWrite(response: {
  data: typeof savedRow | null
  error: { code: string; message?: string } | null
}) {
  const query = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
  }
  mocks.from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: ORGANISER_ID } }, error: null })
})

describe('AC-001.1', () => {
  test("AC-001.1.1: maps every supplied field to the existing database column", async () => {
    const query = mockWrite({ data: savedRow, error: null })
    await saveEventDraft({
      name: ' Dinner ', purpose: 'Celebrate', eventType: 'Dinner', description: 'Team meal',
      proposedStart: '2030-01-01T18:00:00+08:00', proposedEnd: '2030-01-01T20:00:00+08:00',
      expectedAttendance: '25', programme: 'Welcome', layoutPreference: 'Banquet',
      accessibilityRequirements: 'Ramp', equipmentRequirements: 'Microphone',
      registrationRequired: true, specialArrangements: 'Vegetarian meals',
    })
    expect(query.insert).toHaveBeenCalledWith({
      organiser_id: ORGANISER_ID, status: 'draft', name: 'Dinner', purpose: 'Celebrate',
      event_type: 'Dinner', description: 'Team meal',
      proposed_start: '2030-01-01T10:00:00.000Z', proposed_end: '2030-01-01T12:00:00.000Z',
      expected_attendance: 25, programme: 'Welcome', layout_preference: 'Banquet',
      accessibility_requirements: 'Ramp', equipment_requirements: 'Microphone',
      registration_required: true, special_arrangements: 'Vegetarian meals',
    })
  })

  test("AC-001.1.2: rejects invalid details before contacting Supabase", async () => {
    const result = await saveEventDraft({ expectedAttendance: -1 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0].field).toBe('expectedAttendance')
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    ['AC-001.1.3', { data: { user: null }, error: null }],
    ['AC-001.1.4', { data: { user: { id: ORGANISER_ID } }, error: { message: 'Expired session' } }],
  ] as const)("%s: refuses saving without a valid signed-in user (%j)", async (_caseId, session) => {
    mocks.getUser.mockResolvedValue(session)
    expect(await saveEventDraft({})).toEqual({
      ok: false, reason: DRAFT_MESSAGES.notSignedIn, issues: [],
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test.each([
    ['AC-001.1.5', '42501', DRAFT_MESSAGES.notPermitted],
    ['AC-001.1.6', '23503', DRAFT_MESSAGES.unknownOrganiser],
    ['AC-001.1.7', '23514', DRAFT_MESSAGES.invalidDetails],
    ['AC-001.1.8', 'unknown', DRAFT_MESSAGES.saveFailed],
  ] as const)("%s: translates database error %s into an actionable message", async (_caseId, code, reason) => {
    mockWrite({ data: null, error: { code, message: 'Internal database details' } })
    expect(await saveEventDraft({})).toEqual({ ok: false, reason, issues: [] })
  })

  test("AC-001.1.9: handles an authentication network exception", async () => {
    mocks.getUser.mockRejectedValue(new Error('Connection lost'))
    await expect(saveEventDraft({})).resolves.toMatchObject({ ok: false, reason: DRAFT_MESSAGES.saveFailed })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test("AC-001.1.10: handles a lost save response without retrying the insert", async () => {
    const query = mockWrite({ data: null, error: null })
    query.maybeSingle.mockRejectedValue(new Error('Connection lost'))
    await expect(saveEventDraft({})).resolves.toMatchObject({ ok: false, reason: DRAFT_MESSAGES.saveFailed })
    expect(query.insert).toHaveBeenCalledTimes(1)
  })
})

describe('AC-001.2', () => {
  test("AC-001.2.21: saves an empty request as draft for the signed-in owner (also AC-001.1, AC-001.5)", async () => {
    const query = mockWrite({ data: savedRow, error: null })
    expect(await saveEventDraft({})).toEqual({
      ok: true,
      draft: { id: savedRow.id, status: 'draft', updatedAt: savedRow.updated_at },
    })
    expect(mocks.from).toHaveBeenCalledWith('events')
    expect(query.insert).toHaveBeenCalledWith({
      organiser_id: ORGANISER_ID, status: 'draft', name: null, purpose: null,
      event_type: null, description: null, proposed_start: null, proposed_end: null,
      expected_attendance: null, programme: null, layout_preference: null,
      accessibility_requirements: null, equipment_requirements: null,
      registration_required: false, special_arrangements: null,
    })
    expect(query.update).not.toHaveBeenCalled()
  })
})

describe('AC-001.4', () => {
  test("AC-001.4.1: reports an unavailable draft without inserting a replacement (also AC-001.5)", async () => {
    const query = mockWrite({ data: null, error: null })
    expect(await saveEventDraft({}, savedRow.id)).toEqual({
      ok: false, reason: DRAFT_MESSAGES.unavailable, issues: [],
    })
    expect(query.insert).not.toHaveBeenCalled()
  })

  test("AC-001.4.2: a blank existing ID cannot accidentally create a new draft", async () => {
    expect(await saveEventDraft({}, '')).toMatchObject({ ok: false })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('AC-001.5', () => {
  test("AC-001.5.1: updates only the matching owned draft without changing workflow fields (also AC-001.4)", async () => {
    const query = mockWrite({ data: savedRow, error: null })
    const result = await saveEventDraft({ name: 'Updated name', purpose: '' }, savedRow.id)
    expect(result.ok).toBe(true)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.eq.mock.calls).toEqual([
      ['id', savedRow.id], ['organiser_id', ORGANISER_ID], ['status', 'draft'],
    ])
    const fields = query.update.mock.calls[0][0]
    expect(fields).toMatchObject({ name: 'Updated name', purpose: null })
    for (const key of ['status', 'reference', 'submitted_at', 'organiser_id', 'review_note']) {
      expect(fields).not.toHaveProperty(key)
    }
  })

  test.each([
    ['AC-001.5.2', null],
    ['AC-001.5.3', { ...savedRow, status: 'submitted' }],
  ] as const)(
    "%s: does not report success for an absent or non-draft response (%j) (also AC-001.1)", async (_caseId, data) => {
      mockWrite({ data, error: null })
      expect(await saveEventDraft({})).toEqual({
        ok: false, reason: DRAFT_MESSAGES.saveFailed, issues: [],
      })
    },
  )
})
