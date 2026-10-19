import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NotificationsPage } from '../pages/NotificationsPage'

const mocks = vi.hoisted(() => ({
  profile: { id: 'user-1', role: 'coordinator' } as unknown,
  userLoading: false,
  load: vi.fn(),
  markOne: vi.fn(),
  markAll: vi.fn(),
}))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: mocks.profile }),
}))
vi.mock('../notificationService', () => ({
  getMyNotifications: mocks.load,
  markNotificationRead: mocks.markOne,
  markAllNotificationsRead: mocks.markAll,
}))

const NOTICES = [
  { source: 'venue_decision', id: 'n-1', eventId: 'e-1', eventName: 'Gala', eventReference: 'EVT-1',
    title: 'Venue booking rejected', detail: 'Main Hall. Closed that day', createdAt: '2026-01-02T04:00:00Z',
    itemId: 'b-1', readAt: null },
  { source: 'venue_request', id: 'n-2', eventId: 'e-2', eventName: null, eventReference: null,
    title: 'New venue booking request', detail: 'Annex', createdAt: '2026-01-01T04:00:00Z',
    itemId: 'b-2', readAt: '2026-01-01T05:00:00Z' },
  { source: 'email', id: 'n-3', eventId: null, eventName: null, eventReference: null,
    title: 'Welcome', detail: null, createdAt: '2025-12-31T04:00:00Z', itemId: null, readAt: null },
]

function WhereAmI() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<WhereAmI />} />
      </Routes>
    </MemoryRouter>,
  )
}

const items = async () => within(await screen.findByRole('list', { name: 'Your notifications' })).getAllByRole('listitem')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile = { id: 'user-1', role: 'coordinator' }
  mocks.userLoading = false
  mocks.load.mockResolvedValue({ ok: true, notifications: NOTICES })
  mocks.markOne.mockResolvedValue({ ok: true })
  mocks.markAll.mockResolvedValue({ ok: true, count: 2 })
})

describe('AC-032.1 — a user sees their notifications, newest first', () => {
  test('AC-032.1.14: each notification shows what happened, its event and when, in the order the feed gives', async () => {
    renderPage()
    expect(screen.getByText('Loading your notifications…')).toBeInTheDocument()
    const list = await items()
    expect(list.map((item) => item.querySelector('p')?.textContent?.replace('Unread: ', ''))).toEqual([
      'Venue booking rejected', 'New venue booking request', 'Welcome',
    ])
    expect(within(list[0]).getByText('EVT-1 · Gala')).toBeInTheDocument()
    expect(within(list[0]).getByText('Main Hall. Closed that day')).toBeInTheDocument()
    expect(within(list[0]).getByText('2 Jan 2026, 12:00 pm')).toHaveAttribute('dateTime', '2026-01-02T04:00:00Z')
  })

  test('AC-032.1.15: a notice with no visible event or detail shows just what happened and when', async () => {
    renderPage()
    const list = await items()
    expect(list[2].querySelectorAll('p')).toHaveLength(1)
    expect(within(list[1]).getByText('Annex')).toBeInTheDocument()
  })

  test('AC-032.1.16: with no notifications the page says so, with nothing to mark', async () => {
    mocks.load.mockResolvedValue({ ok: true, notifications: [] })
    renderPage()
    expect(await screen.findByText('Nothing yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull()
  })

  test('AC-032.1.17: a failed load shows the error, not an empty list', async () => {
    mocks.load.mockResolvedValue({ ok: false, reason: 'Your notifications could not be loaded. Please try again.' })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(screen.queryByText('Nothing yet')).toBeNull()
  })

  test('AC-032.1.18: leaving before the notifications arrive does not update the page', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderPage()
    await waitFor(() => expect(mocks.load).toHaveBeenCalled())
    unmount()
    finish({ ok: true, notifications: [] })
    await Promise.resolve()
    expect(screen.queryByText('Nothing yet')).toBeNull()
  })
})

describe('AC-032.2 — unread notifications are visibly distinguished', () => {
  test('AC-032.2.5: unread notices are marked as unread, on screen and for screen readers; read ones are not', async () => {
    renderPage()
    const list = await items()
    expect(list[0]).toHaveAttribute('data-unread', 'true')
    expect(within(list[0]).getByText('Unread:')).toBeInTheDocument()
    expect(list[1]).not.toHaveAttribute('data-unread')
    expect(within(list[1]).queryByText('Unread:')).toBeNull()
  })
})

describe('AC-032.3 — opening a notification marks it read and goes to its event or item', () => {
  test('AC-032.3.10: opening an unread notice marks it read, then goes to its event', async () => {
    renderPage()
    fireEvent.click(within((await items())[0]).getByRole('button'))
    expect(await screen.findByTestId('location')).toHaveTextContent('/requests/e-1')
    expect(mocks.markOne).toHaveBeenCalledWith(NOTICES[0])
  })

  test('AC-032.3.11: opening one already read goes straight there without marking it again', async () => {
    mocks.profile = { id: 'user-1', role: 'venue_staff' }
    renderPage()
    fireEvent.click(within((await items())[1]).getByRole('button'))
    expect(await screen.findByTestId('location')).toHaveTextContent('/venues/bookings/b-2/review')
    expect(mocks.markOne).not.toHaveBeenCalled()
  })

  test('AC-032.3.12: a notice with nowhere to go is marked read where it is', async () => {
    renderPage()
    const welcome = (await items())[2]
    fireEvent.click(within(welcome).getByRole('button'))
    await waitFor(() => expect(welcome).not.toHaveAttribute('data-unread'))
    expect(mocks.markOne).toHaveBeenCalledWith(NOTICES[2])
    expect(screen.queryByTestId('location')).toBeNull()
  })

  test('AC-032.3.13: if a notice cannot be marked read, the user is told, and still taken to it', async () => {
    mocks.markOne.mockResolvedValue({ ok: false, reason: 'That notification could not be marked as read. Please try again.' })
    renderPage()
    const welcome = (await items())[2]
    fireEvent.click(within(welcome).getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be marked as read')
    expect(welcome).toHaveAttribute('data-unread', 'true')
  })
})

describe('AC-032.4 — a user can mark all notifications as read', () => {
  test('AC-032.4.4: marking all read shows every notice as read and disables the button', async () => {
    renderPage()
    await items()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled())
    expect((await items()).every((item) => !item.hasAttribute('data-unread'))).toBe(true)
    expect(mocks.markAll).toHaveBeenCalledTimes(1)
  })

  test('AC-032.4.5: with nothing unread the button cannot be used; while marking it says so', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.markAll.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderPage()
    await items()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(await screen.findByRole('button', { name: 'Marking…' })).toBeDisabled()
    finish({ ok: true, count: 2 })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled())
  })

  test('AC-032.4.6: a failed mark-all is reported and nothing is shown as read', async () => {
    mocks.markAll.mockResolvedValue({ ok: false, reason: 'Your notifications could not be marked as read. Please try again.' })
    renderPage()
    await items()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be marked as read')
    expect((await items())[0]).toHaveAttribute('data-unread', 'true')
  })
})

describe('AC-032.5 — a user only ever sees their own notifications', () => {
  test('AC-032.5.7: someone signed out is asked to sign in, and nothing is loaded', () => {
    mocks.profile = null
    renderPage()
    expect(screen.getByText('Sign in to see your notifications.')).toBeInTheDocument()
    expect(mocks.load).not.toHaveBeenCalled()
  })

  test('AC-032.5.8: while the session is still loading, nothing is shown or loaded yet', () => {
    mocks.userLoading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.load).not.toHaveBeenCalled()
  })
})
