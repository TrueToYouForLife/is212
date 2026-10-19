import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserProfile } from '../../../features/auth/types'
import { TopNav } from '../TopNav'

const flags = vi.hoisted(() => ({
  venueBlocks: true, venueSuitability: false, venueManagement: false,
}))
vi.mock('../../../lib/features', () => ({ FEATURES: flags }))
const unread = vi.hoisted(() => ({ count: null as number | null }))
vi.mock('../../../features/notifications/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: (enabled: boolean) => (enabled ? unread.count : null),
}))
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

  test('AC-046.6.11: Venue Staff are offered "Manage venues" once venue management is switched on', () => {
    renderNavFor('venue_staff')
    expect(screen.getAllByRole('link', { name: 'Manage venues' })[0]).toHaveAttribute('href', '/venues/manage')
    cleanup()
    flags.venueManagement = false
    renderNavFor('venue_staff')
    expect(screen.queryAllByRole('link', { name: 'Manage venues' })).toHaveLength(0)
  })

  test.each(['coordinator', 'coordinator_lead', 'organiser', 'operations_manager', 'tech_support', 'attendee'])(
    'AC-046.6.12: a %s is never offered it',
    (role) => {
      renderNavFor(role)
      expect(screen.queryAllByRole('link', { name: 'Manage venues' })).toHaveLength(0)
    },
  )
})

describe('AC-032.1 — a user sees their notifications', () => {
  beforeEach(() => {
    unread.count = null
  })

  test.each(['organiser', 'coordinator', 'coordinator_lead', 'operations_manager', 'venue_staff', 'tech_support', 'attendee'])(
    'AC-032.1.19: a signed-in %s is offered Notifications',
    (role) => {
      renderNavFor(role)
      expect(screen.getAllByRole('link', { name: 'Notifications' })[0]).toHaveAttribute('href', '/notifications')
    },
  )

  test('AC-032.1.20: someone signed out is not offered Notifications', () => {
    render(<MemoryRouter><TopNav session={null} profile={null} loading={false} /></MemoryRouter>)
    expect(screen.queryAllByRole('link', { name: /Notifications/ })).toHaveLength(0)
  })
})

describe('AC-032.2 — an unread count is shown in the navigation', () => {
  beforeEach(() => {
    unread.count = null
  })

  test('AC-032.2.10: the unread count is shown beside Notifications, and read out with it', () => {
    unread.count = 3
    renderNavFor('coordinator')
    const link = screen.getAllByRole('link', { name: 'Notifications, 3 unread' })[0]
    expect(link).toHaveTextContent('Notifications3')
  })

  test('AC-032.2.11: with nothing unread, or the count unknown, no number is shown; over 99 shows 99+', () => {
    unread.count = 0
    renderNavFor('coordinator')
    expect(screen.getAllByRole('link', { name: 'Notifications' })[0]).toHaveTextContent(/^Notifications$/)
    cleanup()
    unread.count = 140
    renderNavFor('coordinator')
    expect(screen.getAllByRole('link', { name: 'Notifications, 140 unread' })[0]).toHaveTextContent('Notifications99+')
  })
})

describe('AC-031.2 — colleagues reach their organisation\u2019s events', () => {
  test('AC-031.2.17: Organisers are offered Our organisation in the navigation', () => {
    renderNavFor('organiser')
    const links = screen.getAllByRole('link', { name: 'Organisation' })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0]).toHaveAttribute('href', '/organisation/events')
  })

  test('AC-031.3.14: no other role is offered it', () => {
    // Navigation shows what this person can actually do. A Coordinator following this
    // link would be refused by the page and by 0078, so offering it would spend their
    // attention for nothing.
    for (const role of ['coordinator', 'coordinator_lead', 'operations_manager',
                        'venue_staff', 'tech_support', 'attendee']) {
      renderNavFor(role)
      expect(screen.queryAllByRole('link', { name: 'Organisation' })).toHaveLength(0)
      cleanup()
    }
  })
})