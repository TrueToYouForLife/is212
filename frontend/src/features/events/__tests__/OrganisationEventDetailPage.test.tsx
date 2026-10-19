import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { OrganisationEventDetailPage } from '../pages/OrganisationEventDetailPage'
import { ORGANISATION_EVENT_MESSAGES as messages } from '../organisationEventService'

/**
 * US31 AC-031.2 and AC-031.3 — the read-only view of a colleague's event, and the route
 * through which US54's AC-054.4 finally becomes reachable.
 *
 * Whether a colleague may read any of this is decided by 0078 and tested against real RLS
 * in organisation_event_access.sql. These check the page renders what came back, keeps the
 * read-only promise, and tells a missing event apart from a broken read.
 */

const mocks = vi.hoisted(() => ({ role: 'organiser' as string, load: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({
    loading: false, session: { userId: 'viewer' }, profile: { id: 'viewer', role: mocks.role },
  }),
}))
vi.mock('../organisationEventService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../organisationEventService')>()),
  loadOrganisationEvent: (id: string) => mocks.load(id),
}))

const EVENT = 'c0ffee00-0000-4000-8000-000000000002'

const theirs = {
  id: EVENT, reference: 'EVT-2046-002', name: 'Northwind Awards',
  status: 'submitted' as const, statusLabel: 'In review',
  proposedStart: '2046-07-01T02:00:00Z', proposedEnd: '2046-07-01T04:00:00Z',
  organiserName: 'Ada Two', isMine: false,
  purpose: 'Recognise the delivery team', eventType: 'Awards dinner',
  expectedAttendance: 120,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/organisation/events/${EVENT}`]}>
      <Routes>
        <Route path="/organisation/events/:id" element={<OrganisationEventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { mocks.role = 'organiser'; mocks.load.mockReset() })

describe('AC-031.2 — a colleague may view the event, and only view it', () => {
  test('AC-031.2.18: the shared details are shown, with the colleague named as organiser', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: theirs })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Northwind Awards' })).toBeInTheDocument()
    expect(screen.getByText(/Ada Two/)).toBeInTheDocument()
    expect(screen.getByText('Recognise the delivery team')).toBeInTheDocument()
    expect(screen.getByText('Awards dinner')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledWith(EVENT)
  })

  test('AC-031.2.19: a colleague is offered no way to change the event', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: theirs })
    renderPage()

    await screen.findByRole('heading', { name: 'Northwind Awards' })
    // The page has no form and no action, so there is nothing to disable — the absence is
    // the assertion. "Open the full request" belongs to the owner and must not appear.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Open the full request/)).not.toBeInTheDocument()
  })

  test('AC-031.2.20: the owner sees the same page with a route into their own request', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: { ...theirs, isMine: true } })
    renderPage()

    expect(await screen.findByText(/Yours/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the full request' }))
      .toHaveAttribute('href', `/requests/${EVENT}`)
  })

  test('AC-031.2.21: a submitted event reads as In review, never as clarification', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: theirs })
    renderPage()

    expect(await screen.findByText('In review')).toBeInTheDocument()
    expect(screen.queryByText('Clarification required')).not.toBeInTheDocument()
  })
})

describe('AC-031.3 — nothing from another client organisation', () => {
  test('AC-031.3.15: another organisation’s event is simply not found, with no retry', async () => {
    mocks.load.mockResolvedValue({ ok: false, reason: messages.notFound })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.notFound)
    // Retrying cannot turn someone else's event into yours, so the button is withheld.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  test('AC-031.3.16: a failed read does offer a retry, and recovers', async () => {
    mocks.load.mockResolvedValueOnce({ ok: false, reason: messages.loadFailed })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.loadFailed)
    mocks.load.mockResolvedValueOnce({ ok: true, value: theirs })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Northwind Awards' })).toBeInTheDocument()
  })

  test('AC-031.3.17: every role but Organiser is refused, and nothing is fetched', async () => {
    for (const role of ['coordinator', 'coordinator_lead', 'operations_manager',
                        'venue_staff', 'tech_support', 'attendee']) {
      mocks.role = role
      mocks.load.mockClear()
      const { unmount } = renderPage()

      expect(await screen.findByText(/available to event organisers only/)).toBeInTheDocument()
      expect(mocks.load).not.toHaveBeenCalled()
      unmount()
    }
  })
})

describe('AC-054.4 — the registrations a colleague may see are now reachable', () => {
  test('AC-054.4.13: the page offers a route into the event’s registrations', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: theirs })
    renderPage()

    // Before this page existed the list was readable by a colleague and reachable by
    // nobody. 0094 still decides whether they actually get it; the link is a courtesy.
    expect(await screen.findByRole('link', { name: 'Open registrations' }))
      .toHaveAttribute('href', `/requests/${EVENT}/registrations`)
  })
})
