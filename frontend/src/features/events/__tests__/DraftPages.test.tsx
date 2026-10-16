import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { SessionContext } from '../../auth/sessionContext'
import type { CurrentUser } from '../../auth/sessionContext'
import type { LoadedEventDraft, LoadEventDraftResult } from '../types'
import { MyDraftsPage } from '../pages/MyDraftsPage'
import { ResumeDraftPage } from '../pages/ResumeDraftPage'

const mocks = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn(), save: vi.fn(), submit: vi.fn() }))

vi.mock('../eventDraftQueryService', () => ({
  listEventDrafts: mocks.list, getEventDraft: mocks.load,
  DRAFT_LOAD_MESSAGES: { listFailed: 'Could not load drafts.', loadFailed: 'Could not load draft.' },
}))

vi.mock('../eventDraftService', () => ({
  saveEventDraft: mocks.save, DRAFT_MESSAGES: { saveFailed: 'Save failed.' },
}))

vi.mock('../eventService', () => ({
  submitEventRequest: mocks.submit, SERVICE_MESSAGES: { network: 'Offline.' },
}))

const user: CurrentUser = {
  session: { userId: 'owner-1', email: null },
  profile: { id: 'owner-1', fullName: 'Organiser', role: 'organiser' },
  loading: false, refresh: async () => {},
}

const draft: LoadedEventDraft = {
  id: 'draft-1', status: 'draft', updatedAt: '2026-09-17T10:00:00Z',
  values: { name: 'Dinner', purpose: 'Celebrate', expectedAttendance: 20,
    proposedStart: '2099-06-01T10:00:00Z', proposedEnd: '2099-06-01T12:00:00Z',
    programme: 'Welcome', registrationRequired: true },
}

function view(path = '/drafts', currentUser = user) {
  return <SessionContext.Provider value={currentUser}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/drafts" element={<MyDraftsPage />} />
        <Route path="/drafts/:id" element={<ResumeDraftPage />} />
      </Routes>
      <Link to="/drafts/draft-2">Other draft</Link>
    </MemoryRouter>
  </SessionContext.Provider>
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.list.mockResolvedValue({ ok: true, drafts: [{
    id: draft.id, name: 'Dinner', purpose: 'Celebrate', status: 'draft', updatedAt: draft.updatedAt,
  }] })
  mocks.load.mockResolvedValue({ ok: true, draft })
  mocks.save.mockResolvedValue({ ok: true, draft })
})

describe('AC-001.3', () => {
  test("AC-001.3.1: unnamed drafts have a usable fallback label (also AC-001.4)", async () => {
    mocks.list.mockResolvedValue({ ok: true, drafts: [{ ...draft, name: null, purpose: null }] })
    render(view())
    expect(await screen.findByRole('link', { name: /Untitled draft/ })).toHaveAttribute('href', '/drafts/draft-1')
  })
})

describe('AC-001.4', () => {
  test("AC-001.4.24: opens a listed draft, restores fields and saves edits to the same ID (also AC-001.3, AC-001.5)", async () => {
    render(view())
    const link = await screen.findByRole('link', { name: /Dinner/ })
    expect(link).toHaveTextContent('Draft')
    fireEvent.click(link)
    expect(await screen.findByLabelText('Event name')).toHaveValue('Dinner')
    expect(screen.getByLabelText(/expected number/i)).toHaveValue(20)
    expect(screen.getByLabelText(/general programme/i)).toHaveValue('Welcome')
    expect(screen.getByLabelText(/attendees must register/i)).toBeChecked()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.submit).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Lunch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    await screen.findByText('Draft saved')
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lunch', expectedAttendance: '20' }), 'draft-1')
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  test("AC-001.4.25: an incomplete draft can reopen and save without required fields (also AC-001.2)", async () => {
    mocks.load.mockResolvedValue({ ok: true, draft: { ...draft, values: {} } })
    render(view('/drafts/draft-1'))
    expect(await screen.findByLabelText('Event name')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    await screen.findByText('Draft saved')
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ purpose: '', proposedStart: '' }), 'draft-1')
  })

  test("AC-001.4.26: empty state offers a new request", async () => {
    mocks.list.mockResolvedValue({ ok: true, drafts: [] })
    render(view())
    await screen.findByText('You have no saved drafts.')
    expect(screen.getByRole('link', { name: 'Start a new request' })).toHaveAttribute('href', '/events/new')
  })

  test("AC-001.4.27: failed list can be retried", async () => {
    mocks.list.mockResolvedValueOnce({ ok: false, reason: 'Offline list' })
    render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline list')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('link', { name: /Dinner/ })
  })

  test("AC-001.4.28: unavailable draft shows no editable form and supports retry", async () => {
    mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Draft unavailable' })
    render(view('/drafts/draft-1'))
    await screen.findByText('Draft unavailable')
    expect(screen.queryByLabelText('Event name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByLabelText('Event name')
  })

  test.each([
    ['AC-001.4.29', { ...user, session: null, profile: null }],
    ['AC-001.4.30', { ...user, profile: { ...user.profile!, role: 'coordinator' as const } }],
    ['AC-001.4.31', { ...user, loading: true }],
  ] as const)("%s: draft queries wait for authorised page access (%j)", async (_caseId, currentUser) => {
    render(view('/drafts/draft-1', currentUser))
    expect(mocks.load).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Event name')).not.toBeInTheDocument()
  })

  test("AC-001.4.32: navigating to another draft ignores an old pending response", async () => {
    let finish!: (result: LoadEventDraftResult) => void
    mocks.load.mockReturnValueOnce(new Promise<LoadEventDraftResult>((resolve) => { finish = resolve }))
    mocks.load.mockResolvedValueOnce({ ok: true, draft: { ...draft, id: 'draft-2', values: { name: 'Second draft' } } })
    render(view('/drafts/draft-1'))
    fireEvent.click(screen.getByRole('link', { name: 'Other draft' }))
    expect(await screen.findByLabelText('Event name')).toHaveValue('Second draft')
    finish({ ok: true, draft })
    await waitFor(() => expect(screen.getByLabelText('Event name')).toHaveValue('Second draft'))
  })

  test("AC-001.4.33: switching accounts clears the previous draft before loading again", async () => {
    const rendered = render(view('/drafts/draft-1'))
    expect(await screen.findByLabelText('Event name')).toHaveValue('Dinner')
    mocks.load.mockResolvedValue({ ok: false, reason: 'Draft unavailable' })
    rendered.rerender(view('/drafts/draft-1', {
      ...user, session: { userId: 'owner-2', email: null },
      profile: { id: 'owner-2', fullName: 'Another organiser', role: 'organiser' },
    }))
    expect(screen.queryByDisplayValue('Dinner')).not.toBeInTheDocument()
    await screen.findByText('Draft unavailable')
  })
})

describe('AC-001.6', () => {
  test("AC-001.6.1: direct draft URL can submit the existing request explicitly (also AC-001.4)", async () => {
    mocks.submit.mockResolvedValue({ ok: true, event: { id: draft.id, status: 'submitted', reference: 'EVT-2099-0001', submittedAt: null } })
    render(view('/drafts/draft-1'))
    await screen.findByLabelText('Event name')
    fireEvent.click(screen.getByRole('button', { name: 'Submit event request' }))
    await screen.findByText('Your event request was submitted')
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'Celebrate' }), 'draft-1')
    expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument()
    // Returning to the list reloads it, so a submitted request can disappear.
    mocks.list.mockResolvedValue({ ok: true, drafts: [] })
    fireEvent.click(screen.getByRole('link', { name: 'Back to My Drafts' }))
    await screen.findByText('You have no saved drafts.')
  })
})
