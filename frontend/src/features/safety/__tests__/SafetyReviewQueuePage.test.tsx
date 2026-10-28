import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { UserProfile } from '../../auth/types'
import { TopNav } from '../../../components/layout/TopNav'
import { SafetyReviewQueuePage } from '../SafetyReviewQueuePage'
import type { QueueEvent } from '../safetyReviewQueueService'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../safetyReviewQueueService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../safetyReviewQueueService')>()),
  getSafetyReviewQueue: mocks.load,
}))
vi.mock('../../notifications/useUnreadNotificationCount', () => ({ useUnreadNotificationCount: () => null }))
vi.mock('../../auth/components/SessionBadge', () => ({ SessionBadge: () => null }))
// US43 tests run with the safety review switched on.
vi.mock('../../../lib/features', async (importOriginal) => ({
  FEATURES: { ...(await importOriginal<typeof import('../../../lib/features')>()).FEATURES, safetyReview: true },
}))

const OLDER: QueueEvent = {
  eventId: 'e-2', reference: 'EVT-2', name: 'Workshop', sentAt: '2042-03-05T01:00:00Z',
  proposedStart: '2042-03-12T01:00:00Z', proposedEnd: '2042-03-12T03:00:00Z', expectedAttendance: 20,
  accessibility: [], venues: [], equipment: [],
}
const NEWER: QueueEvent = {
  eventId: 'e-1', reference: 'EVT-1', name: 'Conference', sentAt: '2042-03-08T01:00:00Z',
  proposedStart: '2042-03-10T01:00:00Z', proposedEnd: '2042-03-10T03:00:00Z', expectedAttendance: 100,
  accessibility: ['Hearing loop', 'Wheelchair access'],
  venues: [
    { venue: 'Annex', location: 'Level 2', layout: 'Classroom', attendance: 45, capacity: 40, accessibility: [], restrictions: ['Under maintenance', 'Open 07:00 to 18:00'] },
    { venue: 'Hall', location: null, layout: 'Theatre', attendance: 100, capacity: 150, accessibility: ['Lift access'], restrictions: [] },
  ],
  equipment: [
    { item: 'Projector', quantity: 2, essential: true, status: 'reserved', reserved: 2 },
    { item: 'Microphone', quantity: 1, essential: false, status: 'unavailable', reserved: 0 },
  ],
}

beforeEach(() => mocks.load.mockReset())

function renderPage() {
  render(<MemoryRouter><SafetyReviewQueuePage /></MemoryRouter>)
}

describe('AC-043.4 — a Safety Officer sees the events awaiting review', () => {
  test('AC-043.4.10: events are listed oldest first, each with when it was sent, its attendance and accessibility needs', async () => {
    mocks.load.mockResolvedValue({ ok: true, events: [OLDER, NEWER] })
    renderPage()
    const items = within(await screen.findByRole('list', { name: 'Events awaiting safety review' })).getAllByRole('listitem')
      .filter((item) => item.parentElement?.getAttribute('aria-label') === 'Events awaiting safety review')
    expect(items.map((item) => within(item).getByRole('heading', { level: 2 }).textContent)).toEqual(['EVT-2 · Workshop', 'EVT-1 · Conference'])
    expect(within(items[1]).getByText(/Sent for review/)).toBeInTheDocument()
    expect(within(items[1]).getByText('100')).toBeInTheDocument()
    expect(within(items[1]).getByText('Hearing loop, Wheelchair access')).toBeInTheDocument()
    expect(within(items[0]).getByText('None recorded')).toBeInTheDocument()
    expect(within(items[0]).getByText('No approved venue bookings.')).toBeInTheDocument()
    expect(within(items[0]).getByText('No equipment requested.')).toBeInTheDocument()
  })

  test('AC-043.4.11: each venue shows its layout, attendance against capacity (flagging over capacity), accessibility and restrictions', async () => {
    mocks.load.mockResolvedValue({ ok: true, events: [NEWER] })
    renderPage()
    const venues = within(await screen.findByRole('list', { name: 'Venues for EVT-1 · Conference' })).getAllByRole('listitem')
    expect(venues[0]).toHaveTextContent('Annex, Level 2')
    expect(venues[0]).toHaveTextContent('Classroom layout: 45 of 40 (over capacity)')
    expect(venues[0]).toHaveTextContent('Restrictions: Under maintenance; Open 07:00 to 18:00')
    expect(venues[0]).toHaveTextContent('Accessibility: None recorded')
    expect(venues[1]).toHaveTextContent('Theatre layout: 100 of 150')
    expect(venues[1]).not.toHaveTextContent('over capacity')
    expect(venues[1]).toHaveTextContent('Accessibility: Lift access')
    expect(venues[1]).toHaveTextContent('Restrictions: None recorded')
  })

  test('AC-043.4.12: the equipment shows each request, whether it is essential, and how many items are reserved', async () => {
    mocks.load.mockResolvedValue({ ok: true, events: [NEWER] })
    renderPage()
    const equipment = within(await screen.findByRole('list', { name: 'Equipment for EVT-1 · Conference' })).getAllByRole('listitem')
    expect(equipment.map((item) => item.textContent)).toEqual([
      'Projector × 2 (essential): 2 of 2 reserved',
      'Microphone × 1: 0 of 1 reserved',
    ])
  })

  test('AC-043.4.13: with nothing waiting it says so; a failed load shows why; an event without a reference uses its name', async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, events: [] })
    const { unmount } = render(<MemoryRouter><SafetyReviewQueuePage /></MemoryRouter>)
    expect(await screen.findByText('No events are awaiting safety review.')).toBeInTheDocument()
    unmount()
    mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Only a Safety Officer can see the events awaiting safety review.' })
    const second = render(<MemoryRouter><SafetyReviewQueuePage /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a Safety Officer')
    second.unmount()
    mocks.load.mockResolvedValueOnce({ ok: true, events: [{ ...OLDER, reference: null }] })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Workshop' })).toBeInTheDocument()
  })

  test('AC-043.4.14: an answer that arrives after the Safety Officer has left the page is ignored', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const page = render(<MemoryRouter><SafetyReviewQueuePage /></MemoryRouter>)
    expect(screen.getByText(/Loading events awaiting review/)).toBeInTheDocument()
    page.unmount()
    finish({ ok: true, events: [NEWER] })
    await Promise.resolve()
    expect(screen.queryByText('EVT-1 · Conference')).toBeNull()
  })

  test('AC-043.4.15: a Safety Officer is offered Safety reviews in the menu; a Coordinator is not', () => {
    const renderNav = (role: string) => render(
      <MemoryRouter><TopNav session={null} profile={{ id: 'u-1', role } as unknown as UserProfile} loading={false} /></MemoryRouter>,
    )
    const { unmount } = renderNav('safety_officer')
    expect(screen.getAllByRole('link', { name: 'Safety reviews' }).length).toBeGreaterThan(0)
    unmount()
    renderNav('coordinator')
    expect(screen.queryAllByRole('link', { name: 'Safety reviews' })).toHaveLength(0)
  })
})
