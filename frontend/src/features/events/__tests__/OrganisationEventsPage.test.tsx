import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { OrganisationEventsPage } from '../pages/OrganisationEventsPage'
import { ORGANISATION_EVENT_MESSAGES } from '../organisationEventService'

/**
 * US31 slice 2 — the screen half of AC-031.1 to AC-031.3 (SCRUM-228).
 *
 * What a colleague may actually reach is decided by 0078 and the ownership-scoped
 * policies, and is tested against real RLS in organisation_event_access.sql. These check
 * the courtesy layer: that the page asks once, tells the two cases apart on screen, and
 * does not invent an empty organisation when a read fails.
 */

const mocks = vi.hoisted(() => ({ role: 'organiser' as string, load: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({
    loading: false, session: { userId: 'viewer' }, profile: { id: 'viewer', role: mocks.role },
  }),
}))
vi.mock('../organisationEventService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../organisationEventService')>()),
  loadOrganisationEvents: () => mocks.load(),
}))

const mine = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2046-001', name: 'Northwind Kickoff', status: 'approved' as const,
  statusLabel: 'Approved', proposedStart: '2046-06-01T02:00:00Z',
  proposedEnd: '2046-06-01T04:00:00Z', organiserName: 'Ama One', isMine: true,
}
const theirs = {
  ...mine,
  id: 'c0ffee00-0000-4000-8000-000000000002',
  reference: 'EVT-2046-002', name: 'Northwind Awards', status: 'submitted' as const,
  statusLabel: 'In review', organiserName: 'Ada Two', isMine: false,
}

function renderPage() {
  return render(<MemoryRouter><OrganisationEventsPage /></MemoryRouter>)
}

beforeEach(() => { mocks.role = 'organiser'; mocks.load.mockReset() })

describe('AC-031.1 — an Organiser can view and act on their own events', () => {
  test('AC-031.1.6: their own event is marked as theirs and links to its request page', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [mine] })
    renderPage()

    const link = await screen.findByRole('link', { name: 'Northwind Kickoff' })
    expect(link).toHaveAttribute('href', '/requests/c0ffee00-0000-4000-8000-000000000001')
    expect(screen.getByText(/Yours/)).toBeInTheDocument()
  })
})

describe('AC-031.2 — colleagues may view, and only view', () => {
  test('AC-031.2.13: a colleague’s event is shown with their name, and opens the read-only view', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [theirs] })
    renderPage()

    expect(await screen.findByText(/Ada Two/)).toBeInTheDocument()
    // Not /requests/:id — that page reads through the owner-scoped service and would only
    // tell a colleague "not found". The organisation view is theirs to open.
    expect(screen.getByRole('link', { name: 'Northwind Awards' }))
      .toHaveAttribute('href', '/organisation/events/c0ffee00-0000-4000-8000-000000000002')
  })

  test('AC-031.2.14: a colleague’s submitted event reads as In review, never as clarification', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [theirs] })
    renderPage()

    expect(await screen.findByText('In review')).toBeInTheDocument()
    expect(screen.queryByText('Clarification required')).not.toBeInTheDocument()
  })

  test('AC-031.2.15: a failed read offers a retry instead of an empty organisation', async () => {
    mocks.load.mockResolvedValueOnce({ ok: false, reason: ORGANISATION_EVENT_MESSAGES.loadFailed })
    renderPage()

    expect(await screen.findByRole('alert'))
      .toHaveTextContent(ORGANISATION_EVENT_MESSAGES.loadFailed)
    expect(screen.queryByText(/has submitted an event request yet/)).not.toBeInTheDocument()

    mocks.load.mockResolvedValueOnce({ ok: true, value: [mine] })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Northwind Kickoff' })).toBeInTheDocument()
  })

  test('AC-031.2.16: an organisation with nothing submitted says so, and asks once', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [] })
    renderPage()

    expect(await screen.findByText(/has submitted an event request yet/)).toBeInTheDocument()
    // One call per mount: a list that re-fetches on render would hammer the projection.
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1))
  })
})

describe('AC-031.3 — nothing from another client organisation', () => {
  test('AC-031.3.13: every role but Organiser is refused the page, and nothing is fetched', async () => {
    for (const role of ['coordinator', 'coordinator_lead', 'operations_manager',
                        'venue_staff', 'tech_support', 'attendee'] as const) {
      mocks.role = role
      mocks.load.mockClear()
      const { unmount } = renderPage()

      expect(await screen.findByText(/available to event organisers only/)).toBeInTheDocument()
      // Hiding the screen is the courtesy; not calling the projection is what keeps a
      // Coordinator's stray client_org_id from ever being exercised from the browser.
      expect(mocks.load).not.toHaveBeenCalled()
      unmount()
    }
  })
})