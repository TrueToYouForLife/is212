import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserProfile } from '../../../features/auth/types'
import { TopNav } from '../TopNav'

const flags = vi.hoisted(() => ({ venueBlocks: true, venueSuitability: false, venueManagement: false }))
vi.mock('../../../lib/features', () => ({ FEATURES: flags }))
vi.mock('../../../features/auth/components/SessionBadge', () => ({ SessionBadge: () => null }))

function renderNavFor(role: string) {
  const profile = { id: 'user-1', role } as unknown as UserProfile
  render(
    <MemoryRouter>
      <TopNav session={null} profile={profile} loading={false} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  flags.venueBlocks = true
})

describe('AC-012.1 — only Venue Staff can block', () => {
  test('AC-012.1.10: Venue Staff are offered the venue blocks page', () => {
    renderNavFor('venue_staff')
    expect(screen.getAllByRole('link', { name: 'Venue blocks' }).length).toBeGreaterThan(0)
  })

  test('AC-012.1.11: coordinators are not offered it', () => {
    renderNavFor('coordinator')
    expect(screen.queryAllByRole('link', { name: 'Venue blocks' })).toHaveLength(0)
  })

  test('AC-012.1.12: while the feature flag is off, Venue Staff are not offered it', () => {
    flags.venueBlocks = false
    renderNavFor('venue_staff')
    expect(screen.queryAllByRole('link', { name: 'Venue blocks' })).toHaveLength(0)
  })
})

describe('AC-012.8 — coordinators are told which bookings need review', () => {
  test('AC-012.8.23: coordinators are offered the venue alerts page', () => {
    renderNavFor('coordinator')
    expect(screen.getAllByRole('link', { name: 'Venue alerts' }).length).toBeGreaterThan(0)
  })

  test('AC-012.8.24: Venue Staff are not offered it', () => {
    renderNavFor('venue_staff')
    expect(screen.queryAllByRole('link', { name: 'Venue alerts' })).toHaveLength(0)
  })

  test('AC-012.8.25: while the feature flag is off, coordinators are not offered it', () => {
    flags.venueBlocks = false
    renderNavFor('coordinator')
    expect(screen.queryAllByRole('link', { name: 'Venue alerts' })).toHaveLength(0)
  })
})

describe('AC-029.4: after signing up, the Attendee is signed in and sees open events', () => {
  test('AC-029.4.9: Attendees are offered the open events page; organisers are not', () => {
    renderNavFor('attendee')
    const links = screen.getAllByRole('link', { name: 'Open events' })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/events/open')
    cleanup()

    renderNavFor('organiser')
    expect(screen.queryAllByRole('link', { name: 'Open events' })).toHaveLength(0)
  })
})

describe('AC-015.7: the Attendee sees their registrations', () => {
  test('AC-015.7.9: Attendees are offered My registrations; organisers are not', () => {
    renderNavFor('attendee')
    const links = screen.getAllByRole('link', { name: 'My registrations' })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/registrations')
    cleanup()

    renderNavFor('organiser')
    expect(screen.queryAllByRole('link', { name: 'My registrations' })).toHaveLength(0)
  })
})

describe('AC-019.1 — staff can view availability across dates', () => {
  test.each(['venue_staff', 'coordinator'])('AC-019.1.25: a %s is offered the availability calendar', (role) => {
    renderNavFor(role)
    expect(screen.getAllByRole('link', { name: 'Availability' })[0]).toHaveAttribute('href', '/venues/availability')
  })

  test.each(['organiser', 'coordinator_lead', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-019.1.26: a %s is not offered it',
    (role) => {
      renderNavFor(role)
      expect(screen.queryAllByRole('link', { name: 'Availability' })).toHaveLength(0)
    },
  )
})

describe('AC-046.6 — only Venue Staff can add venues', () => {
  beforeEach(() => {
    flags.venueManagement = true
  })
  afterEach(() => {
    flags.venueManagement = false
  })

  test('AC-046.6.11: Venue Staff are offered "Add venue" once venue management is switched on', () => {
    renderNavFor('venue_staff')
    expect(screen.getAllByRole('link', { name: 'Add venue' })[0]).toHaveAttribute('href', '/venues/new')
    cleanup()
    flags.venueManagement = false
    renderNavFor('venue_staff')
    expect(screen.queryAllByRole('link', { name: 'Add venue' })).toHaveLength(0)
  })

  test.each(['coordinator', 'coordinator_lead', 'organiser', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-046.6.12: a %s is never offered it',
    (role) => {
      renderNavFor(role)
      expect(screen.queryAllByRole('link', { name: 'Add venue' })).toHaveLength(0)
    },
  )
})
