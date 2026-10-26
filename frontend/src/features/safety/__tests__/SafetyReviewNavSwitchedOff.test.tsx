import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import type { UserProfile } from '../../auth/types'
import { TopNav } from '../../../components/layout/TopNav'

// The safety review is switched off: the app as everyone uses it until the team turns it on.
vi.mock('../../../lib/features', async (importOriginal) => ({
  FEATURES: { ...(await importOriginal<typeof import('../../../lib/features')>()).FEATURES, safetyReview: false },
}))
vi.mock('../../notifications/useUnreadNotificationCount', () => ({ useUnreadNotificationCount: () => null }))
vi.mock('../../auth/components/SessionBadge', () => ({ SessionBadge: () => null }))

describe('AC-043.4 — the review queue appears once the safety review is switched on', () => {
  test('AC-043.4.16: while it is switched off, a Safety Officer is not offered Safety reviews', () => {
    render(<MemoryRouter><TopNav session={null} profile={{ id: 'u-1', role: 'safety_officer' } as unknown as UserProfile} loading={false} /></MemoryRouter>)
    expect(screen.queryAllByRole('link', { name: 'Safety reviews' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThan(0)
  })
})
