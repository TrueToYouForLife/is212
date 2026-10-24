import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NotificationPreferencesPage } from '../NotificationPreferencesPage'

const mocks = vi.hoisted(() => ({
  profile: { id: 'user-1', role: 'coordinator' } as unknown, userLoading: false, load: vi.fn(), save: vi.fn(),
}))
vi.mock('../../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.userLoading, profile: mocks.profile }),
}))
vi.mock('../preferencesService', () => ({ getMyNotificationPreferences: mocks.load, setMyNotificationPreference: mocks.save }))

const PREFERENCES = [
  { typeCode: 'change_request', label: 'Change requests to review', description: 'When an Organiser asks to change one of your events.',
    inApp: true, email: true, customised: false, inAppOffForEveryone: false, emailOffForEveryone: true },
  { typeCode: 'venue_booking_decision', label: 'Venue booking decisions', description: 'When Venue Staff decide.',
    inApp: false, email: true, customised: true, inAppOffForEveryone: false, emailOffForEveryone: false },
]

function renderPage() {
  return render(<MemoryRouter><NotificationPreferencesPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile = { id: 'user-1', role: 'coordinator' }
  mocks.userLoading = false
  mocks.load.mockResolvedValue({ ok: true, preferences: PREFERENCES })
  mocks.save.mockResolvedValue({ ok: true })
})

describe('AC-033.1 — a user sees the notification types that apply to their role', () => {
  test('AC-033.1.5: each type is listed with what it is for and its two switches', async () => {
    renderPage()
    expect(screen.getByText('Loading your notification settings…')).toBeInTheDocument()
    const items = within(await screen.findByRole('list', { name: 'Notification types' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('When an Organiser asks to change one of your events.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'In-app: Change requests to review' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'In-app: Venue booking decisions' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Email: Venue booking decisions' })).toBeChecked()
  })

  test('AC-033.1.6: a role that receives no notifications is told so; a failed load is shown instead of a list', async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, preferences: [] })
    const { unmount } = renderPage()
    expect(await screen.findByText('No notifications are sent to your role yet.')).toBeInTheDocument()
    unmount()
    mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Your notification settings could not be loaded. Please try again.' })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })

  test('AC-033.1.7: signed out, or while the session loads, nothing is loaded; leaving early ignores a late answer', async () => {
    mocks.profile = null
    const { unmount } = renderPage()
    expect(screen.getByText('Sign in to see your notification settings.')).toBeInTheDocument()
    unmount()
    mocks.profile = { id: 'user-1', role: 'coordinator' }
    mocks.userLoading = true
    const loading = renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(mocks.load).not.toHaveBeenCalled()
    loading.unmount()

    mocks.userLoading = false
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const early = renderPage()
    early.unmount()
    finish({ ok: true, preferences: PREFERENCES })
    await Promise.resolve()
  })
})

describe('AC-033.2 — each channel turns on or off independently', () => {
  test('AC-033.2.7: switching email off saves that type with in-app still on, and says it was saved', async () => {
    renderPage()
    const email = await screen.findByRole('checkbox', { name: 'Email: Change requests to review' })
    fireEvent.click(email)
    expect(email).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'In-app: Change requests to review' })).toBeChecked()
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('change_request', true, false))
    expect(await screen.findByText('Change requests to review saved.')).toBeInTheDocument()
  })

  test('AC-033.2.8: while a type is saving its switches are paused; a failed save puts the switch back and says why', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    renderPage()
    const inApp = await screen.findByRole('checkbox', { name: 'In-app: Venue booking decisions' })
    fireEvent.click(inApp)
    expect(inApp).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Email: Venue booking decisions' })).toBeDisabled()
    finish({ ok: false, reason: 'That setting could not be saved. Please try again.' })
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(inApp).not.toBeChecked()
    expect(inApp).not.toBeDisabled()
  })
})

describe('AC-033.2 — a type switched off for everyone says so', () => {
  test('AC-033.2.10: a type an administrator switched off for everyone says which channel, and other types say nothing', async () => {
    renderPage()
    const items = within(await screen.findByRole('list', { name: 'Notification types' })).getAllByRole('listitem')
    expect(within(items[0]).getByText('Email for this type is turned off for everyone by an administrator.')).toBeInTheDocument()
    expect(within(items[1]).queryByText(/turned off for everyone/)).toBeNull()
  })

  test('AC-033.2.11: the note names in-app, or both channels, when those are the ones switched off', async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, preferences: [
      { ...PREFERENCES[0], inAppOffForEveryone: true, emailOffForEveryone: false },
      { ...PREFERENCES[1], inAppOffForEveryone: true, emailOffForEveryone: true },
    ] })
    renderPage()
    expect(await screen.findByText('In-app notices of this type are turned off for everyone by an administrator.')).toBeInTheDocument()
    expect(screen.getByText('Turned off for everyone by an administrator, in the app and by email.')).toBeInTheDocument()
  })
})

