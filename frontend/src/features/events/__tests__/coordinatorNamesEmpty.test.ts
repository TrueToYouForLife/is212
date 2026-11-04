import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadCoordinatorNames } from '../eventCoordinatorService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => mocks.rpc.mockReset())

describe('AC-004.3 — coordinator names on the request list', () => {
  test('AC-004.3.8: when the database returns no rows at all, no names are shown and nothing breaks', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await loadCoordinatorNames(['e-1'])).toEqual({ ok: true, value: {} })
  })
})
