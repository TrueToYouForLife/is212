import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  PREFERENCE_MESSAGES as messages, getMyNotificationPreferences, setMyNotificationPreference,
} from '../preferencesService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const ROW = {
  type_code: 'change_request', label: 'Change requests to review', description: 'When an Organiser asks to change one of your events.',
  in_app: true, email: false, customised: true,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-033.1 — a user sees the notification types that apply to their role', () => {
  test('AC-033.1.3: the settings are read in one call and each type keeps its name, description and choices', async () => {
    mocks.rpc.mockResolvedValue({ data: [ROW], error: null })
    expect(await getMyNotificationPreferences()).toEqual({ ok: true, preferences: [{
      typeCode: 'change_request', label: 'Change requests to review', description: 'When an Organiser asks to change one of your events.',
      inApp: true, email: false, customised: true,
    }] })
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_notification_preferences')
  })

  test('AC-033.1.4: no types is an empty list; signed out asks to sign in; a failed or unexpected answer is reported and logged', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getMyNotificationPreferences()).toEqual({ ok: true, preferences: [] })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sign in' } })
    expect(await getMyNotificationPreferences()).toEqual({ ok: false, reason: messages.notSignedIn })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await getMyNotificationPreferences()).toEqual({ ok: false, reason: messages.loadFailed })
    mocks.rpc.mockResolvedValueOnce({ data: [{ type_code: 'x' }], error: null })
    expect(await getMyNotificationPreferences()).toEqual({ ok: false, reason: messages.loadFailed })
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe('AC-033.2 — each channel turns on or off independently', () => {
  test('AC-033.2.5: a choice saves both channels for its type in one call', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await setMyNotificationPreference('change_request', true, false)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('set_my_notification_preference', { p_type: 'change_request', p_in_app: true, p_email: false })
  })

  test('AC-033.2.6: a type that does not apply, being signed out or an unexpected failure is reported', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'no' } })
    expect(await setMyNotificationPreference('x', true, true)).toEqual({ ok: false, reason: messages.notApplicable })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sign in' } })
    expect(await setMyNotificationPreference('x', true, true)).toEqual({ ok: false, reason: messages.notSignedIn })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await setMyNotificationPreference('x', true, true)).toEqual({ ok: false, reason: messages.saveFailed })
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})
