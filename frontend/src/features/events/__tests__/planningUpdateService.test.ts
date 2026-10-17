import { beforeEach, expect, test, vi } from 'vitest'
import { getEventPlanning, updateEventPlanning, PLANNING_MESSAGES } from '../planningUpdateService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
const id = '20020000-0000-4000-8000-000000000001'
const values = { name: ' Workshop ', purpose: 'Planning', proposedStart: '2099-01-10T01:00:00Z',
  proposedEnd: '2099-01-10T03:00:00Z', expectedAttendance: 10, facilityRequirements: ['wifi'], registrationRequired: true }
beforeEach(() => vi.resetAllMocks())

test('AC-020.1.30: saves validated details with the loaded version and excludes registration', async () => {
  mocks.rpc.mockResolvedValue({ data: id, error: null })
  expect(await updateEventPlanning(id, 'v1', values, {})).toEqual({ ok: true, changed: true })
  const args = mocks.rpc.mock.calls[0]
  expect(args[0]).toBe('update_event_planning')
  expect(args[1]).toMatchObject({ p_event_id: id, p_version: 'v1', p_values: {
    name: 'Workshop', expectedAttendance: 10, facilityRequirements: ['wifi'], proposedStart: '2099-01-10T01:00:00.000Z',
  } })
  expect(args[1].p_values).not.toHaveProperty('registrationRequired')
})
test('AC-020.1.31: invalid id, missing version and invalid details never reach the database', async () => {
  for (const [event, version, input] of [['bad', 'v', values], [id, '', values], [id, 'v', { ...values, expectedAttendance: 0 }]] as const) {
    expect(await updateEventPlanning(event, version, input, {})).toEqual({ ok: false, reason: PLANNING_MESSAGES.invalid })
  }
  expect(mocks.rpc).not.toHaveBeenCalled()
})
test('AC-020.1.32: stale, permission, state, catalogue and unexpected errors have actionable messages', async () => {
  for (const [code, message] of [['40001', 'stale'], ['42501', 'forbidden'], ['22000', 'status'], ['23514', 'invalid'], ['XX000', 'failed']] as const) {
    mocks.rpc.mockResolvedValue({ error: { code, message: 'private database detail' } })
    expect(await updateEventPlanning(id, 'v', values, {})).toEqual({ ok: false, reason: PLANNING_MESSAGES[message] })
  }
})
test('AC-020.1.33: lost response and malformed success are uncertain saves and never automatically retried', async () => {
  mocks.rpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: 'broken', error: null })
  expect(await updateEventPlanning(id, 'v', values, {})).toEqual({ ok: false, reason: PLANNING_MESSAGES.failed })
  expect(await updateEventPlanning(id, 'v', values, {})).toEqual({ ok: false, reason: PLANNING_MESSAGES.failed })
  expect(mocks.rpc).toHaveBeenCalledTimes(2)
})
test('AC-020.1.34: an unchanged save is successful without claiming a new update', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect(await updateEventPlanning(id, 'v', values, {})).toEqual({ ok: true, changed: false })
})
test('AC-020.2.5: loads the server history and structured values together with their version', async () => {
  const data = { version: 'v', status: 'approved', values: { ...values, name: 'Workshop', eventType: null,
    description: null, programme: null, layoutPreference: null, accessibilityRequirements: [], equipmentRequirements: [], specialArrangements: null },
  history: [{ id, changed_by_name: 'Coordinator', changed_at: '2026-01-01T00:00:00Z', changes: { name: { before: null, after: 'Workshop' } } }] }
  mocks.rpc.mockResolvedValue({ data, error: null })
  const result = await getEventPlanning(id)
  expect(result.ok && result.value.history).toEqual(data.history)
  expect(mocks.rpc).toHaveBeenCalledWith('get_event_planning', { p_event_id: id })
})
test('AC-020.2.6: read failures or malformed history never become an empty success', async () => {
  expect(await getEventPlanning('bad')).toEqual({ ok: false, reason: PLANNING_MESSAGES.load })
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.rpc.mockResolvedValueOnce({ error: { code: '42501' } }).mockResolvedValueOnce({ data: { history: [] } })
    .mockRejectedValueOnce(new Error('offline'))
  for (let i = 0; i < 3; i++) expect(await getEventPlanning(id)).toEqual({ ok: false, reason: PLANNING_MESSAGES.load })
})
