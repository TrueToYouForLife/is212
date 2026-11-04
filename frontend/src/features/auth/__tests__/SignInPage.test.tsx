import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SignInPage } from '../pages/SignInPage'
import { SessionContext } from '../sessionContext'
import type { CurrentUser } from '../sessionContext'
import type { AppSession } from '../types'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  getCurrentSession: vi.fn(),
}))

// The page is the unit here; the service is stubbed so no Supabase client is involved.
vi.mock('../authService', () => mocks)

const session: AppSession = {
  userId: '3f7c1c62-2f4e-4f3f-9a23-2b1a6b6a8f11',
  email: 'organiser@example.com',
}

function renderSignIn(overrides: Partial<CurrentUser> = {}, from?: string) {
  // A signed-out context that never updates, so the page's own navigate() is the only thing
  // that can move us off /signin.
  const value: CurrentUser = { session: null, profile: null, loading: false, refresh: vi.fn(), ...overrides }

  render(
    <SessionContext.Provider value={value}>
      <MemoryRouter initialEntries={[{ pathname: '/signin', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/requested" element={<p>Requested page</p>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

function submitCredentials(buttonName: RegExp) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: session.email } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret-password' } })
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signIn.mockResolvedValue({ ok: true })
  mocks.signUp.mockResolvedValue({ ok: true })
  mocks.getCurrentSession.mockResolvedValue(session)
})

// Development sign-in for US-005 — US-002 owns the real authentication story, so these carry
// no acceptance-criterion prefix.
describe('SignInPage', () => {
  test('invalid fields display validation errors without sending credentials', () => {
    renderSignIn()
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  test('an existing session redirects to the originally requested page', async () => {
    renderSignIn({ session }, '/requested')
    expect(await screen.findByText('Requested page')).toBeInTheDocument()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  test('does not redirect while the existing session is being checked', () => {
    renderSignIn({ session, loading: true }, '/requested')
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.queryByText('Requested page')).not.toBeInTheDocument()
  })
  test('goes where the user was headed once signed in', async () => {
    renderSignIn()

    submitCredentials(/^sign in$/i)

    expect(await screen.findByText('Home page')).toBeInTheDocument()
    expect(mocks.signIn).toHaveBeenCalledWith(session.email, 'secret-password')
  })

  test('stays on the sign-in page and says why when the credentials are refused', async () => {
    mocks.signIn.mockResolvedValue({ ok: false, reason: 'Invalid login credentials' })
    renderSignIn()

    submitCredentials(/^sign in$/i)

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()
  })

})

// The in-page "Create account" mode this page used to have is replaced by /signup (US29);
// its confirm-your-email behaviour is now AC-029.4.3.
describe('AC-029.3: self sign-up never grants an internal or organiser role', () => {
  test('AC-029.3.16: the sign-in page no longer promises an organiser account', () => {
    renderSignIn()

    expect(screen.queryByText(/set up as an event organiser/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create one/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/signup')
  })
})
