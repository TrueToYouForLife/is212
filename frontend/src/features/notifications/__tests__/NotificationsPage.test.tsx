import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NotificationsPage } from '../pages/NotificationsPage'

const mocks = vi.hoisted(() => ({ profile: { id: 'user-1', role: 'coordinator' } as unknown, userLoading: false, load: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: mocks.profile }),
}))
vi.mock('../notificationService', () => ({ getMyNotifications: mocks.load }))

const NOTICES = [
  { source: 'venue_decision', id: 'n-1', eventId: 'e-1', eventName: 'Gala', eventReference: 'EVT-1',
    title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', createdAt: '2026-01-02T04:00:00Z' },
  { source: 'venue_request', id: 'n-2', eventId: 'e-2', eventName: null, eventReference: null,
    title: 'New venue booking request', detail: 'Annex', createdAt: '2026-01-01T04:00:00Z' },
  { source: 'email', id: 'n-3', eventId: null, eventName: null, eventReference: null,
    title: 'Welcome', detail: null, createdAt: '2025-12-31T04:00:00Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile = { id: 'user-1', role: 'coordinator' }
  mocks.userLoading = false
  mocks.load.mockResolvedValue({ ok: true, notifications: NOTICES })
})

describe('AC-032.1 — a user sees their notifications, newest first', () => {
  test('AC-032.1.14: each notification shows what happened, its event and when, in the order the feed gives', async () => {
    render(<NotificationsPage />)
    expect(screen.getByText('Loading your notifications…')).toBeInTheDocument()
    const items = within(await screen.findByRole('list', { name: 'Your notifications' })).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Venue booking rejected', 'New venue booking request', 'Welcome',
    ])
    expect(within(items[0]).getByText('EVT-1 · Gala')).toBeInTheDocument()
    expect(within(items[0]).getByText('Main Hall. Closed that day')).toBeInTheDocument()
    expect(within(items[0]).getByText('2 Jan 2026, 12:00 pm')).toHaveAttribute('dateTime', '2026-01-02T04:00:00Z')
  })

  test('AC-032.1.15: a notice with no visible event or detail shows just what happened and when', async () => {
    render(<NotificationsPage />)
    const items = within(await screen.findByRole('list', { name: 'Your notifications' })).getAllByRole('listitem')
    expect(items[2].querySelectorAll('p')).toHaveLength(1)
    expect(within(items[1]).getByText('Annex')).toBeInTheDocument()
  })

  test('AC-032.1.16: with no notifications the page says so', async () => {
    mocks.load.mockResolvedValue({ ok: true, notifications: [] })
    render(<NotificationsPage />)
    expect(await screen.findByText('Nothing yet')).toBeInTheDocument()
  })

  test('AC-032.1.17: a failed load shows the error, not an empty list', async () => {
    mocks.load.mockResolvedValue({ ok: false, reason: 'Your notifications could not be loaded. Please try again.' })
    render(<NotificationsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByText('Nothing yet')).toBeNull()
  })

  test('AC-032.1.18: leaving before the notifications arrive does not update the page', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = render(<NotificationsPage />)
    await waitFor(() => expect(mocks.load).toHaveBeenCalled())
    unmount()
    finish({ ok: true, notifications: [] })
    await Promise.resolve()
    expect(screen.queryByText('Nothing yet')).toBeNull()
  })
})

describe('AC-032.5 — a user only ever sees their own notifications', () => {
  test('AC-032.5.7: someone signed out is asked to sign in, and nothing is loaded', () => {
    mocks.profile = null
    render(<NotificationsPage />)
    expect(screen.getByText('Sign in to see your notifications.')).toBeInTheDocument()
    expect(mocks.load).not.toHaveBeenCalled()
  })

  test('AC-032.5.8: while the session is still loading, nothing is shown or loaded yet', () => {
    mocks.userLoading = true
    render(<NotificationsPage />)
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.load).not.toHaveBeenCalled()
  })
})
