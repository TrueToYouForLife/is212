import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SignUpPage } from '../pages/SignUpPage'
import { SessionContext } from '../sessionContext'
import type { CurrentUser } from '../sessionContext'
import type { AppSession } from '../types'

const mocks = vi.hoisted(() => ({ signUp: vi.fn() }))

// The page is the unit here; the service is stubbed so no Supabase client is involved.
vi.mock('../authService', () => ({
  signUp: mocks.signUp,
  AUTH_MESSAGES: {
    duplicateEmail: 'An account with this email already exists. Sign in instead.',
  },
}))

const duplicateMessage = 'An account with this email already exists. Sign in instead.'
const signedIn: AppSession = { userId: 'user-1', email: 'ada@example.test' }

function renderSignUp(session: AppSession | null = null, loading = false) {
  const value: CurrentUser = { session, profile: null, loading, refresh: vi.fn() }

  render(
    <SessionContext.Provider value={value}>
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/events/open" element={<p>Open events page</p>} />
          <Route path="/signin" element={<p>Sign-in page</p>} />
          <Route path="/" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

function fillIn(values: { fullName: string; email: string; password: string }) {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: values.fullName } })
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: values.password } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: /create account/i }))
const valid = { fullName: '  Ada Tan ', email: 'ada@example.test', password: 'secret1' }

test('a session arriving during sign-up opens events rather than the existing-account home page', async () => {
  let finish!: (value: { ok: true; signedIn: boolean }) => void
  mocks.signUp.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const content = (session: AppSession | null) => <SessionContext.Provider value={{ session, profile: null, loading: false, refresh: vi.fn() }}>
    <MemoryRouter initialEntries={['/signup']}><Routes>
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/events/open" element={<p>Open events page</p>} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes></MemoryRouter>
  </SessionContext.Provider>
  const view = render(content(null))
  fillIn(valid)
  submit()
  await waitFor(() => expect(mocks.signUp).toHaveBeenCalledOnce())
  view.rerender(content(signedIn))
  expect(await screen.findByText('Open events page')).toBeInTheDocument()
  expect(screen.queryByText('Home page')).not.toBeInTheDocument()
  await act(async () => finish({ ok: true, signedIn: true }))
})

test('session loading does not redirect before the account has been checked', () => {
  renderSignUp(signedIn, true)
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  expect(screen.queryByText('Home page')).not.toBeInTheDocument()
})

test('an invalid email receives its own field error', async () => {
  renderSignUp()
  fillIn({ ...valid, email: 'invalid' })
  submit()
  await waitFor(() => expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('aria-invalid', 'true'))
  expect(mocks.signUp).not.toHaveBeenCalled()
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.signUp.mockResolvedValue({ ok: true, signedIn: false })
})

describe('AC-029.1: sign up with a name, email and password', () => {
  test('AC-029.1.15: submitting the form signs up with the cleaned values', async () => {
    renderSignUp()
    fillIn(valid)
    submit()

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1))
    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ada Tan', email: 'ada@example.test', password: 'secret1' }),
    )
  })

  test('AC-029.1.16: invalid input shows field errors and is not sent', async () => {
    renderSignUp()
    fillIn({ fullName: '', email: 'ada@example.test', password: 'abcde' })
    submit()

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Your password must be at least 6 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  test('AC-029.1.17: a sign-up error is shown and the input is kept', async () => {
    mocks.signUp.mockResolvedValue({ ok: false, reason: 'Password is too weak' })
    renderSignUp()
    fillIn(valid)
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Password is too weak')
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ada@example.test')
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })
})

describe('AC-029.2: an email that already has an account cannot sign up again', () => {
  test('AC-029.2.4: a duplicate email is explained, with a way to sign in instead', async () => {
    mocks.signUp.mockResolvedValue({ ok: false, reason: duplicateMessage, duplicate: true })
    renderSignUp()
    fillIn(valid)
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(duplicateMessage)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin')
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
  })
})

describe('AC-029.3: self sign-up never grants an internal or organiser role', () => {
  test('AC-029.3.15: the form offers no role choice of any kind', async () => {
    renderSignUp()

    // Attendee is the only account anyone can create here; organisers and staff are set up by
    // the team, so there is nothing to choose and no way to ask.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText(/organiser/i)).not.toBeInTheDocument()

    fillIn(valid)
    submit()

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1))
    expect(mocks.signUp.mock.calls[0][0]).not.toHaveProperty('requestOrganiser')
  })
})

describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  test('AC-029.4.3: with email confirmation on, explains that the link signs them in', async () => {
    renderSignUp()
    fillIn(valid)
    submit()

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/check your email/i)
    expect(status).toHaveTextContent(/events open for registration/i)
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
  })

  test('AC-029.4.4: when a session comes back, goes straight to the open events page', async () => {
    mocks.signUp.mockResolvedValue({ ok: true, signedIn: true })
    renderSignUp()
    fillIn(valid)
    submit()

    expect(await screen.findByText('Open events page')).toBeInTheDocument()
  })

  test('AC-029.4.5: someone already signed in is sent home instead', () => {
    renderSignUp(signedIn)
    expect(screen.getByText('Home page')).toBeInTheDocument()
  })
})
