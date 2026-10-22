import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EventRegistrationsPage } from '../pages/EventRegistrationsPage'
import { EVENT_REGISTRATIONS_MESSAGES as messages } from '../eventRegistrationsService'

/**
 * US54 — the screen half of AC-054.1 to AC-054.4 (SCRUM-246).
 *
 * Who may read a roll call is decided by 0094 and tested against real RLS in
 * event_registration_visibility.sql. These check that the page shows what came back, tells
 * a refusal apart from a failure, and never invents an empty event.
 */

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, session: { userId: 'viewer' } }),
}))
vi.mock('../eventRegistrationsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../eventRegistrationsService')>()),
  loadEventRegistrations: (id: string) => mocks.load(id),
}))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

const active = {
  id: 'r1', attendeeName: 'Ada Attendee', attendeeEmail: 'ada@example.test',
  status: 'registered' as const, registeredAt: '2046-09-01T02:00:00Z', withdrawnAt: null,
}
const withdrawn = {
  id: 'r2', attendeeName: 'Ben Attendee', attendeeEmail: 'ben@example.test',
  status: 'withdrawn' as const, registeredAt: '2046-09-02T02:00:00Z',
  withdrawnAt: '2046-09-03T02:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/requests/${EVENT}/registrations`]}>
      <Routes>
        <Route path="/requests/:id/registrations" element={<EventRegistrationsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { mocks.load.mockReset() })

describe('AC-054.1 — each registration, with the attendee’s details', () => {
  test('AC-054.1.9: the attendee’s name, email and registration date are shown', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: { registrations: [active], activeCount: 1 } })
    renderPage()

    expect(await screen.findByText('Ada Attendee')).toBeInTheDocument()
    expect(screen.getByText('ada@example.test')).toBeInTheDocument()
    expect(screen.getByText(/Registered/)).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledWith(EVENT)
  })

  test('AC-054.1.10: a failed read offers a retry rather than an empty event', async () => {
    mocks.load.mockResolvedValueOnce({ ok: false, reason: messages.loadFailed })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.loadFailed)
    expect(screen.queryByText(/Nobody has registered/)).not.toBeInTheDocument()

    mocks.load.mockResolvedValueOnce({
      ok: true, value: { registrations: [active], activeCount: 1 },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Ada Attendee')).toBeInTheDocument()
  })
})

describe('AC-054.2 — withdrawn registrations are marked and not counted', () => {
  test('AC-054.2.7: the count is of active registrations, with withdrawals listed separately', async () => {
    mocks.load.mockResolvedValue({
      ok: true, value: { registrations: [active, withdrawn], activeCount: 1 },
    })
    renderPage()

    const summary = await screen.findByText(/active registration/)
    expect(summary).toHaveTextContent('1 active registration')
    expect(summary).toHaveTextContent('1 withdrawn')
  })

  test('AC-054.2.8: a withdrawn attendee is still listed, and marked', async () => {
    mocks.load.mockResolvedValue({
      ok: true, value: { registrations: [active, withdrawn], activeCount: 1 },
    })
    renderPage()

    expect(await screen.findByText('Ben Attendee')).toBeInTheDocument()
    expect(screen.getByText('Withdrawn')).toBeInTheDocument()
  })

  test('AC-054.2.9: an event everyone withdrew from reads zero, not empty', async () => {
    // Boundary: "0 active" and "nobody has registered" are different facts, and only one
    // of them is true here.
    mocks.load.mockResolvedValue({ ok: true, value: { registrations: [withdrawn], activeCount: 0 } })
    renderPage()

    expect(await screen.findByText(/active registrations/)).toBeInTheDocument()
    expect(screen.queryByText(/Nobody has registered/)).not.toBeInTheDocument()
  })

  test('AC-054.2.10: an event nobody has registered for says so', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: { registrations: [], activeCount: 0 } })
    renderPage()

    expect(await screen.findByText(/Nobody has registered for this event yet/)).toBeInTheDocument()
  })
})

describe('AC-054.4 — a refusal is final, and looks it', () => {
  test('AC-054.4.11: someone who may not look is told so, with no retry offered', async () => {
    mocks.load.mockResolvedValue({ ok: false, reason: messages.notPermitted })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.notPermitted)
    // Retrying a refusal will never succeed; offering the button would invite someone to
    // keep knocking at a door the database has already closed.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  test('AC-054.4.12: the page asks the database rather than deciding access itself', async () => {
    // Three different audiences may read this list. Reproducing that predicate here would
    // be a second copy to keep in step with 0094, so the page just renders the answer.
    mocks.load.mockResolvedValue({ ok: true, value: { registrations: [active], activeCount: 1 } })
    renderPage()

    expect(await screen.findByText('Ada Attendee')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })
})
