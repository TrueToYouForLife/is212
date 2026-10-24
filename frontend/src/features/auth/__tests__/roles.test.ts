import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getMyProfile } from '../authService'
import { USER_ROLES, USER_ROLE_LABELS, isUserRole } from '../types'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: {}, from: mocks.from },
}))

const USER_ID = '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11'

function mockProfileRow(row: Record<string, unknown> | null, error: { message: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn((_column: string, _value: string) => ({ maybeSingle }))
  const select = vi.fn((_columns: string) => ({ eq }))
  mocks.from.mockReturnValue({ select })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('role vocabulary', () => {
  test('recognises the supported application role vocabulary', () => {
    // Database acceptance and permissions are covered separately by SQL tests.
    expect([...USER_ROLES]).toEqual([
      'organiser',
      'coordinator',
      'coordinator_lead',
      'operations_manager',
      'venue_staff',
      'tech_support',
      'safety_officer',
      'attendee',
    ])
  })

  test('every role has a human-readable label', () => {
    for (const role of USER_ROLES) {
      expect(USER_ROLE_LABELS[role]).toBeTruthy()
    }
  })

  test('rejects a value that is not one of the known roles', () => {
    expect(isUserRole('organiser')).toBe(true)
    expect(isUserRole('operations_manager')).toBe(true)
    expect(isUserRole('admin')).toBe(false)
    expect(isUserRole(null)).toBe(false)
  })
})

describe('getMyProfile', () => {
  test('returns the profile with its role for the signed-in user', async () => {
    mockProfileRow({ id: USER_ID, full_name: 'Test Organiser', role: 'coordinator' })

    const profile = await getMyProfile(USER_ID)

    expect(profile).toEqual({ id: USER_ID, fullName: 'Test Organiser', role: 'coordinator' })
  })

  test('AC-ROLES.1-01: recognises an assigned operations manager profile', async () => {
    mockProfileRow({ id: USER_ID, full_name: 'Manager', role: 'operations_manager' })
    expect(await getMyProfile(USER_ID)).toEqual({ id: USER_ID, fullName: 'Manager', role: 'operations_manager' })
  })

  test('returns null for an unrecognised role rather than defaulting to organiser', async () => {
    // Defaulting would silently grant access the database never granted. Better to have no
    // usable profile than a wrong one.
    mockProfileRow({ id: USER_ID, full_name: 'Test', role: 'superuser' })

    expect(await getMyProfile(USER_ID)).toBeNull()
  })

  test('returns null when the profile row does not exist yet', async () => {
    mockProfileRow(null)

    expect(await getMyProfile(USER_ID)).toBeNull()
  })

  test('returns null when the lookup is refused', async () => {
    mockProfileRow(null, { message: 'permission denied for table profiles' })

    expect(await getMyProfile(USER_ID)).toBeNull()
  })
})
