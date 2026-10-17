import { beforeEach, describe, expect, test, vi } from 'vitest'
import { setEventRegistration } from '../registrationSettingService'
import { canChangeRegistration } from '../statusRules'
import type { EventStatus } from '../types'

/**
 * US52 (SCRUM-245), service and rule level. The database is the control (0057 checks the
 * role, the assignment and the status); these cases pin what the browser sends and what
 * it tells the coordinator when the database refuses.
 */
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '52100000-0000-4000-8000-000000000008'

beforeEach(() => { vi.clearAllMocks() })

describe('AC-052.1: the assigned coordinator enables or disables registration', () => {
  test('AC-052.1.11: sends the event and the requested on/off value to set_event_registration', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    expect(await setEventRegistration(eventId, false)).toEqual({ ok: true })
    expect(await setEventRegistration(eventId, true)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'set_event_registration', { p_event_id: eventId, p_enabled: false })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'set_event_registration', { p_event_id: eventId, p_enabled: true })
  })

  test('AC-052.1.12: a refusal for someone who is not the assigned coordinator says so', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'denied' } })
    expect(await setEventRegistration(eventId, false)).toEqual({
      ok: false, reason: 'Only the coordinator assigned to this event can change registration.',
    })
  })

  test('AC-052.1.13: a refusal because the event is not Confirmed says so', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '22000', message: 'status' } })
    const result = await setEventRegistration(eventId, false)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain('Confirmed')
  })

  test('AC-052.1.14: any other database error gives a generic message without the raw error', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'XX000', message: 'secret internals' } })
    const result = await setEventRegistration(eventId, true)
    expect(result).toEqual({ ok: false, reason: 'Registration could not be changed. Please try again.' })
  })

  test('AC-052.1.15: an event id that is not a UUID is rejected before any request is made', async () => {
    const result = await setEventRegistration('not-a-uuid', false)
    expect(result.ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-052.1.16: a lost response is reported as unconfirmed and is not retried', async () => {
    mocks.rpc.mockRejectedValue(new Error('network'))
    const result = await setEventRegistration(eventId, false)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain('could not be confirmed')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  test('AC-052.1.17: the switch is offered for a Confirmed event and for no other status', () => {
    const statuses: EventStatus[] = ['draft', 'submitted', 'under_review', 'approved', 'planning',
      'confirmed', 'completed', 'cancelled', 'rejected']
    expect(statuses.filter(canChangeRegistration)).toEqual(['confirmed'])
  })
})
