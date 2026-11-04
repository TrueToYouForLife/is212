import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SessionProvider } from '../SessionProvider'
import { useCurrentUser } from '../sessionContext'
import type { AppSession, UserProfile } from '../types'

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  onSessionChange: vi.fn(),
  getMyProfile: vi.fn(),
  unsubscribe: vi.fn(),
  listener: null as null | ((session: AppSession | null) => void),
}))
vi.mock('../authService', () => ({
  getCurrentSession: mocks.getCurrentSession,
  onSessionChange: mocks.onSessionChange,
  getMyProfile: mocks.getMyProfile,
}))

const SESSION = { userId: 'user-1', email: 'coordinator@test.com' } as unknown as AppSession
const PROFILE = { id: 'user-1', role: 'coordinator', fullName: 'Casey' } as unknown as UserProfile

function Consumer() {
  const { session, profile, loading, refresh } = useCurrentUser()
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>session: {session?.userId ?? 'none'}</p>
      <p>profile: {profile?.role ?? 'none'}</p>
      <button type="button" onClick={() => void refresh()}>refresh</button>
    </div>
  )
}

async function flush() {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  mocks.getCurrentSession.mockReset()
  mocks.getMyProfile.mockReset()
  mocks.unsubscribe.mockReset()
  mocks.listener = null
  mocks.onSessionChange.mockImplementation((fn: (session: AppSession | null) => void) => {
    mocks.listener = fn
    return mocks.unsubscribe
  })
})

describe('AC-029.4 — after signing in, the app knows who the user is', () => {
  test('AC-029.4.13: while the session is being checked the app is loading; a signed-out visitor then has no session or profile', async () => {
    let finish: (value: AppSession | null) => void = () => undefined
    mocks.getCurrentSession.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(<SessionProvider><Consumer /></SessionProvider>)
    expect(screen.getByText('loading: true')).toBeInTheDocument()
    await act(async () => { finish(null) })
    expect(screen.getByText('loading: false')).toBeInTheDocument()
    expect(screen.getByText('session: none')).toBeInTheDocument()
    expect(screen.getByText('profile: none')).toBeInTheDocument()
    expect(mocks.getMyProfile).not.toHaveBeenCalled()
  })

  test('AC-029.4.14: a signed-in user stays loading until their profile arrives, then both are known', async () => {
    mocks.getCurrentSession.mockResolvedValue(SESSION)
    let finishProfile: (value: UserProfile | null) => void = () => undefined
    mocks.getMyProfile.mockImplementation(() => new Promise((resolve) => { finishProfile = resolve }))
    render(<SessionProvider><Consumer /></SessionProvider>)
    await flush()
    expect(screen.getByText('session: user-1')).toBeInTheDocument()
    expect(screen.getByText('loading: true')).toBeInTheDocument()
    await act(async () => { finishProfile(PROFILE) })
    expect(screen.getByText('loading: false')).toBeInTheDocument()
    expect(screen.getByText('profile: coordinator')).toBeInTheDocument()
    expect(mocks.getMyProfile).toHaveBeenCalledWith('user-1')
  })

  test('AC-029.4.15: a sign-in or sign-out after the page loaded is picked up, and the profile follows the session', async () => {
    mocks.getCurrentSession.mockResolvedValue(null)
    mocks.getMyProfile.mockResolvedValue(PROFILE)
    render(<SessionProvider><Consumer /></SessionProvider>)
    await flush()
    expect(screen.getByText('session: none')).toBeInTheDocument()
    await act(async () => { mocks.listener?.(SESSION) })
    await flush()
    expect(screen.getByText('session: user-1')).toBeInTheDocument()
    expect(screen.getByText('profile: coordinator')).toBeInTheDocument()
    await act(async () => { mocks.listener?.(null) })
    await flush()
    expect(screen.getByText('session: none')).toBeInTheDocument()
    expect(screen.getByText('profile: none')).toBeInTheDocument()
  })

  test('AC-029.4.16: refresh fetches the profile again without a session event (the dev role switcher)', async () => {
    mocks.getCurrentSession.mockResolvedValue(SESSION)
    mocks.getMyProfile.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce({ ...PROFILE, role: 'venue_staff' })
    render(<SessionProvider><Consumer /></SessionProvider>)
    await flush()
    expect(screen.getByText('profile: coordinator')).toBeInTheDocument()
    await act(async () => { screen.getByRole('button', { name: 'refresh' }).click() })
    await flush()
    expect(screen.getByText('profile: venue_staff')).toBeInTheDocument()
    expect(mocks.getMyProfile).toHaveBeenCalledTimes(2)
  })

  test('AC-029.4.17: leaving the app unsubscribes from the session, and a late answer is ignored; using the hook outside the provider is an error', async () => {
    let finish: (value: AppSession | null) => void = () => undefined
    mocks.getCurrentSession.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = render(<SessionProvider><Consumer /></SessionProvider>)
    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
    await act(async () => { finish(SESSION); mocks.listener?.(SESSION) })
    expect(mocks.getMyProfile).not.toHaveBeenCalled()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Consumer />)).toThrow('useCurrentUser must be used inside a SessionProvider')
    spy.mockRestore()
  })
})
