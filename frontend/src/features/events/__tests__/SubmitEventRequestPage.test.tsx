import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SubmitEventRequestPage } from '../pages/SubmitEventRequestPage'
import type { UserProfile } from '../../auth/types'

const mocks = vi.hoisted(() => ({
  user: { session: null as null | { userId: string; email: string | null }, profile: null as UserProfile | null, loading: false },
}))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => mocks.user }))
// The form has its own tests; here it only has to appear for the right person.
vi.mock('../components/EventRequestForm', () => ({ EventRequestForm: () => <form aria-label="Event request form" /> }))

function renderPage() {
  return render(<MemoryRouter><SubmitEventRequestPage /></MemoryRouter>)
}

beforeEach(() => {
  mocks.user.session = null
  mocks.user.profile = null
  mocks.user.loading = false
})

describe('AC-002.1 — only a signed-in organiser can submit a request', () => {
  test('AC-002.1.15: while the session is being checked the page says so and shows no form', () => {
    mocks.user.loading = true
    renderPage()
    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Event request form' })).toBeNull()
  })

  test('AC-002.1.16: a signed-out visitor is asked to sign in, and is brought back here afterwards', () => {
    renderPage()
    expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(screen.queryByRole('form', { name: 'Event request form' })).toBeNull()
  })

  test('AC-002.1.17: a signed-in user with no profile is told to ask an administrator', () => {
    mocks.user.session = { userId: 'user-1', email: 'x@test.com' }
    renderPage()
    expect(screen.getByText('No organiser profile')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Event request form' })).toBeNull()
  })

  test('AC-002.1.18: another role is told requests are submitted by the organiser, naming their role', () => {
    mocks.user.session = { userId: 'user-1', email: 'x@test.com' }
    mocks.user.profile = { id: 'user-1', fullName: 'Casey', role: 'coordinator' }
    renderPage()
    expect(screen.getByText('Not available for your role')).toBeInTheDocument()
    expect(screen.getByText('Event Coordinator')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Event request form' })).toBeNull()
  })

  test('AC-002.1.19: an organiser gets the form, a link to their drafts, and the guidance on what happens next', () => {
    mocks.user.session = { userId: 'user-1', email: 'x@test.com' }
    mocks.user.profile = { id: 'user-1', fullName: 'Olive', role: 'organiser' }
    renderPage()
    expect(screen.getByRole('form', { name: 'Event request form' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Drafts' })).toHaveAttribute('href', '/drafts')
    expect(screen.getByText('What happens next')).toBeInTheDocument()
    expect(screen.getByText('You submit')).toBeInTheDocument()
    expect(screen.getByText('A coordinator reviews')).toBeInTheDocument()
    expect(screen.getByText('A venue is matched')).toBeInTheDocument()
    expect(screen.getByText('Before you submit')).toBeInTheDocument()
  })
})
