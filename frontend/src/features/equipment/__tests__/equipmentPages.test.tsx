import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EventEquipmentPage } from '../pages/EventEquipmentPage'
import { ReserveEquipmentPage } from '../pages/ReserveEquipmentPage'
import { TechSupportEquipmentPage } from '../pages/TechSupportEquipmentPage'
import { REQUIREMENT_STATUSES } from '../types'
import type { UserProfile } from '../../auth/types'

const mocks = vi.hoisted(() => ({ user: { profile: null as UserProfile | null, loading: false } }))
vi.mock('../../auth/sessionContext', () => ({ useCurrentUser: () => mocks.user }))
// The inner components have their own tests; here each page only has to show the right one
// to the right person, with the event and viewer it was given.
vi.mock('../components/EquipmentRequirementsEditor', () => ({
  EquipmentRequirementsEditor: ({ eventId, viewer }: { eventId: string; viewer: { id: string; role: string } }) =>
    <p>{`editor for ${eventId} as ${viewer.role} ${viewer.id}`}</p>,
}))
vi.mock('../components/EquipmentOutcomeNotices', () => ({
  EquipmentOutcomeNotices: ({ eventId }: { eventId: string }) => <p>{`outcome notices for ${eventId}`}</p>,
}))
vi.mock('../components/ReservationQueue', () => ({
  ReservationQueue: ({ viewer }: { viewer: { id: string; role: string } }) => <p>{`reservation queue as ${viewer.role}`}</p>,
}))
vi.mock('../components/TechSupportEquipmentView', () => ({ TechSupportEquipmentView: () => <p>tech support equipment view</p> }))

const profile = (role: UserProfile['role']): UserProfile => ({ id: 'user-1', fullName: 'Test', role })

function renderEventPage() {
  return render(
    <MemoryRouter initialEntries={['/requests/evt-1/equipment']}>
      <Routes><Route path="/requests/:id/equipment" element={<EventEquipmentPage />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.user.profile = null
  mocks.user.loading = false
})

describe('AC-013.1 — the event equipment page', () => {
  test('AC-013.1.12: while loading it waits; signed out it asks to sign in; the editor is shown for the event and viewer', () => {
    mocks.user.loading = true
    const { unmount } = renderEventPage()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    unmount()
    mocks.user.loading = false
    const second = renderEventPage()
    expect(screen.getByText('Sign in to view equipment requirements.')).toBeInTheDocument()
    second.unmount()
    mocks.user.profile = profile('tech_support')
    renderEventPage()
    expect(screen.getByText('editor for evt-1 as tech_support user-1')).toBeInTheDocument()
    expect(screen.queryByText(/outcome notices/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Request' })).toHaveAttribute('href', '/requests/evt-1')
  })

  test('AC-013.1.13: a coordinator also sees their equipment outcome notices for the event (US14)', () => {
    mocks.user.profile = profile('coordinator')
    renderEventPage()
    expect(screen.getByText('outcome notices for evt-1')).toBeInTheDocument()
    expect(screen.getByText('editor for evt-1 as coordinator user-1')).toBeInTheDocument()
  })
})

describe('AC-014.1 — the reserve equipment and tech support pages', () => {
  test('AC-014.1.9: the reserve page waits, asks a signed-out visitor to sign in, and shows the queue for the viewer', () => {
    mocks.user.loading = true
    const { unmount } = render(<ReserveEquipmentPage />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    unmount()
    mocks.user.loading = false
    const second = render(<ReserveEquipmentPage />)
    expect(screen.getByText('Sign in to reserve equipment.')).toBeInTheDocument()
    second.unmount()
    mocks.user.profile = profile('tech_support')
    render(<ReserveEquipmentPage />)
    expect(screen.getByText('reservation queue as tech_support')).toBeInTheDocument()
  })

  test('AC-014.1.10: the equipment page is for Technical Support only; other roles are told so', () => {
    mocks.user.loading = true
    const { unmount } = render(<TechSupportEquipmentPage />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    unmount()
    mocks.user.loading = false
    mocks.user.profile = profile('coordinator')
    const second = render(<TechSupportEquipmentPage />)
    expect(screen.getByText('This page is for Technical Support staff.')).toBeInTheDocument()
    second.unmount()
    mocks.user.profile = profile('tech_support')
    render(<TechSupportEquipmentPage />)
    expect(screen.getByText('tech support equipment view')).toBeInTheDocument()
  })

  test('AC-013.1.14: the requirement statuses are the four the database allows, in order', () => {
    expect(REQUIREMENT_STATUSES).toEqual(['pending_review', 'reserved', 'partially_reserved', 'unavailable'])
  })
})
