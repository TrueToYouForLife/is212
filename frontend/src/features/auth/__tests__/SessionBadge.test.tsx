import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { SessionBadge } from '../components/SessionBadge'
import { signOut } from '../authService'

vi.mock('../authService', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

test('loading hides sign-in and stale account details', () => {
  render(<SessionBadge loading session={{ userId: 'one', email: 'old@example.test' }} profile={null} />)
  expect(screen.getByText(/Checking session/)).toBeInTheDocument()
  expect(screen.queryByText('old@example.test')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('signed-out users have a sign-in link', () => {
  render(<MemoryRouter><SessionBadge loading={false} session={null} profile={null} /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
})

test('signed-in users see their email and role and can sign out', () => {
  render(<SessionBadge loading={false} session={{ userId: 'one', email: 'one@example.test' }} profile={{ id: 'one', fullName: 'One', role: 'coordinator' }} />)
  expect(screen.getByText('one@example.test')).toBeInTheDocument()
  expect(screen.getByText('Event Coordinator')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(signOut).toHaveBeenCalledOnce()
})

test('a session without email or profile remains signed in without inventing a role', () => {
  render(<SessionBadge loading={false} session={{ userId: 'one', email: null }} profile={null} />)
  expect(screen.getByText('Signed in')).toBeInTheDocument()
  expect(screen.getByText('?')).toBeInTheDocument()
  expect(screen.queryByText('Event Coordinator')).not.toBeInTheDocument()
})
