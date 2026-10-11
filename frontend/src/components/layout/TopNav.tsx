import { NavLink } from 'react-router-dom'
import { SessionBadge } from '../../features/auth/components/SessionBadge'
import type { AppSession, UserProfile, UserRole } from '../../features/auth/types'
import { BrandMark } from './BrandMark'
import { FEATURES } from '../../lib/features'

interface TopNavProps {
  session: AppSession | null
  profile: UserProfile | null
  loading: boolean
}

interface NavItem {
  label: string
  to: string
}

/**
 * Navigation shows what this person can actually do, and nothing else. Listing features
 * that are unavailable — greyed out, or as links that refuse on arrival — spends the
 * user's attention on our internal schedule instead of their task.
 */
function navItemsFor(role: UserRole | null): NavItem[] {
  const home: NavItem = { label: 'Home', to: '/' }

  switch (role) {
    case 'organiser':
      return [
        home,
        { label: 'New request', to: '/events/new' },
        { label: 'My Drafts', to: '/drafts' },
        { label: 'My requests', to: '/requests' },
      ]
    case 'coordinator':
      return [
        home,
        { label: 'Requests', to: '/requests' },
        { label: 'Venues', to: '/venues/search' },
        ...(FEATURES.venueSuitability ? [{ label: 'Suitability', to: '/venues/suitability' }] : []),
        ...(FEATURES.venueBooking ? [{ label: 'My bookings', to: '/venues/bookings' }] : []),
        ...(FEATURES.venueBlocks ? [{ label: 'Venue alerts', to: '/venues/alerts' }] : []),
      ]
    case 'coordinator_lead':
      return [home, { label: 'Assignments', to: '/requests' }]
    case 'operations_manager':
      return [home, { label: 'Requests', to: '/requests' }]
    case 'tech_support':
      return [
        home,
        { label: 'Equipment', to: '/equipment' },
        { label: 'Reserve equipment', to: '/equipment/reservations' },
      ]
    case 'attendee':
      return [
        home,
        { label: 'Open events', to: '/events/open' },
        { label: 'My registrations', to: '/registrations' },
      ]
    case 'venue_staff':
      return [
        home,
        ...(FEATURES.venueBooking ? [{ label: 'Booking requests', to: '/venues/review' }] : []),
        ...(FEATURES.venueBlocks ? [{ label: 'Venue blocks', to: '/venues/blocks' }] : []),
      ]
    default:
      return [home]
  }
}

const baseItemClasses = 'rounded-md px-3 py-2 text-sm font-medium transition'

export function TopNav({ session, profile, loading }: TopNavProps) {
  const items = navItemsFor(profile?.role ?? null)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <NavLink
          to="/"
          className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <BrandMark />
        </NavLink>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? `${baseItemClasses} bg-slate-100 text-slate-900`
                      : `${baseItemClasses} text-slate-600 hover:bg-slate-50 hover:text-slate-900`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto">
          <SessionBadge session={session} profile={profile} loading={loading} />
        </div>
      </div>
    </header>
  )
}
