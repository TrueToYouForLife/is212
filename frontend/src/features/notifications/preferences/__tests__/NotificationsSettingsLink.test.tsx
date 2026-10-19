import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NotificationsPage } from '../../pages/NotificationsPage'

const mocks = vi.hoisted(() => ({ flags: { notificationPreferences: false }, load: vi.fn() }))
vi.mock('../../../../lib/features', () => ({ FEATURES: mocks.flags }))
vi.mock('../../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'user-1', role: 'coordinator' } }),
}))
vi.mock('../../notificationService', () => ({
  getMyNotifications: mocks.load, markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
}))

beforeEach(() => {
  mocks.load.mockResolvedValue({ ok: true, notifications: [] })
})

describe('AC-033.1 — a user can reach their notification settings', () => {
  test('AC-033.1.8: the Notifications page links to the settings once the feature is switched on, and not before', async () => {
    mocks.flags.notificationPreferences = false
    const { unmount } = render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
    await screen.findByText('Nothing yet')
    expect(screen.queryByRole('link', { name: 'Notification settings' })).toBeNull()
    unmount()

    mocks.flags.notificationPreferences = true
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Notification settings' })).toHaveAttribute('href', '/notifications/settings')
  })
})
