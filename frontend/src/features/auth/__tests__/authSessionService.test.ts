import { beforeEach, expect, test, vi } from 'vitest'
import { AUTH_MESSAGES, getCurrentSession, onSessionChange, signIn, signOut, signUp } from '../authService'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), signUp: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { auth } }))
beforeEach(() => vi.resetAllMocks())

test.each([
  [null, null],
  [{ user: { id: 'one', email: 'one@example.test' } }, { userId: 'one', email: 'one@example.test' }],
  [{ user: { id: 'one' } }, { userId: 'one', email: null }],
])('session lookup maps authentication state %j', async (session, expected) => {
  auth.getSession.mockResolvedValue({ data: { session } })
  await expect(getCurrentSession()).resolves.toEqual(expected)
})

test('session listener reports sign-in, missing email and sign-out, and unsubscribes', () => {
  const unsubscribe = vi.fn()
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
  const listener = vi.fn()
  const cleanup = onSessionChange(listener)
  const callback = auth.onAuthStateChange.mock.calls[0][0]
  callback('SIGNED_IN', { user: { id: 'one', email: 'one@example.test' } })
  callback('TOKEN_REFRESHED', { user: { id: 'one' } })
  callback('SIGNED_OUT', null)
  expect(listener.mock.calls).toEqual([[{ userId: 'one', email: 'one@example.test' }], [{ userId: 'one', email: null }], [null]])
  cleanup()
  expect(unsubscribe).toHaveBeenCalledOnce()
})

test.each([
  [null, { ok: true }],
  [{ message: 'Invalid credentials' }, { ok: false, reason: 'Invalid credentials' }],
  [{ message: '' }, { ok: false, reason: AUTH_MESSAGES.signInFailed }],
])('sign-in preserves successful and unsuccessful outcomes %j', async (error, expected) => {
  auth.signInWithPassword.mockResolvedValue({ error })
  await expect(signIn('one@example.test', 'password')).resolves.toEqual(expected)
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'one@example.test', password: 'password' })
})

test('sign-out waits for the authentication service', async () => {
  auth.signOut.mockResolvedValue({ error: null })
  await expect(signOut()).resolves.toBeUndefined()
  expect(auth.signOut).toHaveBeenCalledOnce()
})

test('sign-up supplies a fallback for an error without a message', async () => {
  auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: '' } })
  await expect(signUp({ fullName: 'One', email: 'one@example.test', password: 'password' })).resolves.toEqual({ ok: false, reason: AUTH_MESSAGES.signUpFailed })
})
