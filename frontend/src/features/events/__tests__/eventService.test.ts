import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SERVICE_MESSAGES, submitEventRequest } from '../eventService'
import { VALIDATION_MESSAGES } from '../validation'
import { EVENT_STATUS_LABELS } from '../types'
import type { EventRequestInput } from '../types'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  },
}))

const ORGANISER_ID = '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11'

const validInput: EventRequestInput = {
  name: 'Client Appreciation Dinner',
  purpose: 'Thank our largest clients and announce next year’s programme',
  proposedStart: '2099-06-01T18:00',
  proposedEnd: '2099-06-01T22:00',
  expectedAttendance: '120',
}

interface InsertedRow {
  id: string
  reference: string | null
  status: string
  submitted_at: string | null
}

interface PostgrestError {
  code?: string
  message?: string
}

function mockInsert(response: { data: InsertedRow | null; error: PostgrestError | null }) {
  const single = vi.fn().mockResolvedValue(response)
  const select = vi.fn((_columns: string) => ({ single }))
  const insert = vi.fn((_row: Record<string, unknown>) => ({ select }))
  mocks.from.mockReturnValue({ insert })
  return { insert, select, single }
}

const submittedRow: InsertedRow = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2026-0042',
  status: 'submitted',
  submitted_at: '2026-01-05T02:11:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: ORGANISER_ID } }, error: null })
})

function mockDraftUpdate(data: InsertedRow | null, error: PostgrestError | null = null) {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn(),
  }
  mocks.from.mockReturnValue(query)
  return query
}

describe('AC-001.6', () => {
  test("AC-001.6.5: submits the existing owned draft with its latest details in one update", async () => {
    const query = mockDraftUpdate(submittedRow)
    const result = await submitEventRequest(validInput, submittedRow.id)
    expect(result.ok).toBe(true)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.eq.mock.calls).toEqual([
      ['id', submittedRow.id], ['organiser_id', ORGANISER_ID], ['status', 'draft'],
    ])
    const payload = query.update.mock.calls[0][0]
    expect(payload).toMatchObject({ status: 'submitted', expected_attendance: 120, purpose: validInput.purpose })
    expect(payload).not.toHaveProperty('reference')
    expect(payload).not.toHaveProperty('submitted_at')
  })

  test("AC-001.6.6: refuses a missing, inaccessible or already submitted draft without inserting", async () => {
    const query = mockDraftUpdate(null)
    expect(await submitEventRequest(validInput, submittedRow.id)).toMatchObject({
      ok: false, reason: SERVICE_MESSAGES.draftUnavailable,
    })
    expect(query.insert).not.toHaveBeenCalled()
  })

  test("AC-001.6.7: revalidates incomplete drafts before attempting submission", async () => {
    const query = mockDraftUpdate(null)
    expect((await submitEventRequest({}, submittedRow.id)).ok).toBe(false)
    expect(query.update).not.toHaveBeenCalled()
  })

  test("AC-001.6.8: reports a database refusal during draft submission", async () => {
    mockDraftUpdate(null, { code: '42501' })
    expect(await submitEventRequest(validInput, submittedRow.id)).toMatchObject({
      ok: false, reason: SERVICE_MESSAGES.rlsDenied,
    })
  })

  test("AC-001.6.9: a blank draft ID cannot fall back to creating a second request", async () => {
    const query = mockDraftUpdate(null)
    expect((await submitEventRequest(validInput, '')).ok).toBe(false)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.update).not.toHaveBeenCalled()
  })
})

describe('AC-002.1', () => {
  test('AC-002.1.5: optional details the organiser omitted are stored as null, not empty strings', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })
    await submitEventRequest({ ...validInput, programme: '   ' })
    const payload = insert.mock.calls[0][0]
    expect(payload.programme).toBeNull()
    expect(payload.equipment_requirements).toBeNull()
    expect(payload.registration_required).toBe(false)
  })
})

describe('AC-002.4', () => {
  test('AC-002.4.1: an invalid request is rejected with the failing rule, not a generic message', async () => {
    const { insert } = mockInsert({ data: null, error: null })
    const result = await submitEventRequest({ ...validInput, purpose: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toContain(VALIDATION_MESSAGES.purposeRequired)
    expect(result.issues).toEqual([
      { field: 'purpose', message: VALIDATION_MESSAGES.purposeRequired },
    ])
    expect(insert).not.toHaveBeenCalled()
  })

  test('AC-002.4.2: a submission without a signed-in user explains that sign-in is required', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { insert } = mockInsert({ data: null, error: null })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.notSignedIn)
    expect(insert).not.toHaveBeenCalled()
  })

  test('AC-002.4.3: a row-level-security refusal is reported as a permission problem', async () => {
    mockInsert({ data: null, error: { code: '42501', message: 'new row violates policy' } })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.rlsDenied)
  })

  test('AC-002.4.4: a database CHECK violation is reported without leaking the constraint name', async () => {
    mockInsert({
      data: null,
      error: { code: '23514', message: 'violates check constraint "submitted_requires_core_fields"' },
    })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.constraintViolation)
    expect(result.reason).not.toContain('submitted_requires_core_fields')
  })

  test('AC-002.4.5: a unique-reference collision is reported so the organiser can retry', async () => {
    mockInsert({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.duplicateReference)
  })

  test('AC-002.4.6: a missing organiser profile is reported as a profile problem', async () => {
    mockInsert({ data: null, error: { code: '23503', message: 'foreign key violation' } })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.unknownOrganiser)
  })

  test('AC-002.4.7: an unrecognised database error gives advice, not raw Postgres text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockInsert({
      data: null,
      error: { code: '42703', message: 'column events.review_note does not exist' },
    })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.unexpected)
    expect(result.reason).not.toContain('review_note')
    expect(console.error).toHaveBeenCalled()
  })

  test('AC-002.4.8: never throws, even given a malformed payload', async () => {
    await expect(
      submitEventRequest({ purpose: null, proposedStart: null } as unknown as EventRequestInput),
    ).resolves.toMatchObject({ ok: false })
  })
})

describe('AC-002.5', () => {
  test('AC-002.5.1: a successful submission returns a unique reference in EVT-YYYY-NNNN form', async () => {
    mockInsert({ data: submittedRow, error: null })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.reference).toMatch(/^EVT-\d{4}-\d{4}$/)
  })

  test('AC-002.5.2: a successful submission is stored with status "Submitted"', async () => {
    mockInsert({ data: submittedRow, error: null })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.status).toBe('submitted')
    expect(EVENT_STATUS_LABELS[result.event.status]).toBe('Submitted')
    expect(result.event.submittedAt).toBe('2026-01-05T02:11:00.000Z')
  })

  test('AC-002.5.3: the client sends status submitted but never a reference of its own', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })
    await submitEventRequest(validInput)
    const payload = insert.mock.calls[0][0]
    expect(payload.status).toBe('submitted')
    expect(payload).not.toHaveProperty('reference')
    expect(payload).not.toHaveProperty('submitted_at')
  })

  test('AC-002.5.4: the request is filed against the signed-in organiser', async () => {
    const { insert } = mockInsert({ data: submittedRow, error: null })
    await submitEventRequest(validInput)
    const payload = insert.mock.calls[0][0]
    expect(payload.organiser_id).toBe(ORGANISER_ID)
    expect(mocks.from).toHaveBeenCalledWith('events')
  })

  test('AC-002.5.5: a saved row that came back without a reference is treated as a failure', async () => {
    mockInsert({ data: { ...submittedRow, reference: null }, error: null })
    const result = await submitEventRequest(validInput)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(SERVICE_MESSAGES.missingReference)
  })
})