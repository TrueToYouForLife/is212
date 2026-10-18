import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useUnreadNotificationCount } from '../useUnreadNotificationCount'

const mocks = vi.hoisted(() => ({ count: vi.fn() }))
vi.mock('../notificationService', () => ({
  NOTIFICATIONS_CHANGED: 'connectsphere:notifications-changed',
  getUnreadNotificationCount: mocks.count,
}))

let goTo: (path: string) => void = () => undefined
function Probe({ enabled }: { enabled: boolean }) {
  const count = useUnreadNotificationCount(enabled)
  goTo = useNavigate()
  return <p data-testid="count">{count === null ? 'none' : String(count)}</p>
}

function renderProbe(enabled = true) {
  return render(<MemoryRouter initialEntries={['/']}><Probe enabled={enabled} /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockResolvedValue({ ok: true, count: 3 })
})

describe('AC-032.2 — an unread count is shown in the navigation', () => {
  test('AC-032.2.6: the count is read when the nav appears', async () => {
    renderProbe()
    expect(screen.getByTestId('count')).toHaveTextContent('none')
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'))
  })

  test('AC-032.2.7: the count is read again on every page change and whenever notifications are marked read', async () => {
    renderProbe()
    await waitFor(() => expect(mocks.count).toHaveBeenCalledTimes(1))
    mocks.count.mockResolvedValue({ ok: true, count: 1 })
    act(() => goTo('/notifications'))
    await waitFor(() => expect(mocks.count).toHaveBeenCalledTimes(2))
    act(() => { window.dispatchEvent(new Event('connectsphere:notifications-changed')) })
    await waitFor(() => expect(mocks.count).toHaveBeenCalledTimes(3))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  test('AC-032.2.8: a count that cannot be read shows no number rather than a wrong one', async () => {
    mocks.count.mockResolvedValue({ ok: false, reason: 'could not be loaded' })
    renderProbe()
    await waitFor(() => expect(mocks.count).toHaveBeenCalled())
    expect(screen.getByTestId('count')).toHaveTextContent('none')
  })

  test('AC-032.2.9: signed out, nothing is read; an answer arriving after leaving is ignored', async () => {
    renderProbe(false)
    expect(mocks.count).not.toHaveBeenCalled()
    expect(screen.getByTestId('count')).toHaveTextContent('none')

    let finish: (value: unknown) => void = () => undefined
    mocks.count.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderProbe()
    unmount()
    finish({ ok: true, count: 9 })
    await Promise.resolve()
  })
})
