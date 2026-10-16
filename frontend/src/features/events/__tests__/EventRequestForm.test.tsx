import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EventRequestForm } from '../components/EventRequestForm'
import type { SaveEventDraftResult, SubmitEventRequestResult } from '../types'

const mocks = vi.hoisted(() => ({ submitEventRequest: vi.fn(), saveEventDraft: vi.fn() }))

// The form is presentational; persistence belongs to the service, so the service is what
// we stub. No Supabase client is involved in a component test.
vi.mock('../eventService', () => ({
  submitEventRequest: mocks.submitEventRequest,
  SERVICE_MESSAGES: { network: 'Service unreachable.' },
}))

vi.mock('../eventDraftService', () => ({
  saveEventDraft: mocks.saveEventDraft,
  DRAFT_MESSAGES: { saveFailed: 'Save not confirmed.' },
}))

const success: SubmitEventRequestResult = {
  ok: true,
  event: {
    id: 'c0ffee00-0000-4000-8000-000000000001',
    reference: 'EVT-2026-0042',
    status: 'submitted',
    submittedAt: '2026-01-05T02:11:00.000Z',
  },
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/purpose of the event/i), {
    target: { value: 'Annual client appreciation dinner' },
  })
  fireEvent.change(screen.getByLabelText(/preferred start/i), {
    target: { value: '2099-06-01T18:00' },
  })
  fireEvent.change(screen.getByLabelText(/preferred end/i), {
    target: { value: '2099-06-01T22:00' },
  })
  fireEvent.change(screen.getByLabelText(/expected number of attendees/i), {
    target: { value: '120' },
  })
}

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /submit event request/i }))

beforeEach(() => {
  vi.resetAllMocks()
})

const savedDraft: SaveEventDraftResult = {
  ok: true,
  draft: { id: 'draft-1', status: 'draft', updatedAt: '2026-09-17T10:00:00Z' },
}

const saveDraft = () => fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

describe('AC-001.1', () => {
  test("AC-001.1.11: shows save errors and preserves entered values", async () => {
    mocks.saveEventDraft.mockResolvedValue({ ok: false, reason: 'Invalid attendance.',
      issues: [{ field: 'expectedAttendance', message: 'Attendance must be positive.' }] })
    render(<EventRequestForm />)
    fireEvent.change(screen.getByLabelText(/expected number/i), { target: { value: '-1' } })
    saveDraft()
    expect(await screen.findByText('Invalid attendance.')).toBeInTheDocument()
    expect(screen.getByText('Attendance must be positive.')).toBeInTheDocument()
    expect(screen.getByLabelText(/expected number/i)).toHaveValue(-1)
  })

  test("AC-001.1.12: an unexpected save exception restores the controls without losing input", async () => {
    mocks.saveEventDraft.mockRejectedValue(new Error('Offline'))
    render(<EventRequestForm />)
    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Dinner' } })
    saveDraft()
    expect(await screen.findByRole('alert')).toHaveTextContent('Save not confirmed.')
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled()
    expect(screen.getByLabelText('Event name')).toHaveValue('Dinner')
  })
})

describe('AC-001.2', () => {
  test("AC-001.2.22: clears submission-required errors when saving an incomplete draft", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    render(<EventRequestForm />)
    submit()
    await screen.findByText('Purpose is required.')
    saveDraft()
    await screen.findByText('Draft saved')
    expect(screen.queryByText('Purpose is required.')).not.toBeInTheDocument()
  })
})

describe('AC-001.3', () => {
  test("AC-001.3.2: saves an empty draft without submitting and displays Draft status (also AC-001.1, AC-001.2, AC-001.5)", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    render(<EventRequestForm />)
    saveDraft()
    expect(await screen.findByRole('status')).toHaveTextContent('Draft saved')
    expect(screen.getByText('Draft', { exact: true })).toBeInTheDocument()
    expect(mocks.saveEventDraft).toHaveBeenCalledWith(expect.objectContaining({ purpose: '' }), undefined)
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
    expect(screen.queryByText('Purpose is required.')).not.toBeInTheDocument()
  })
})

describe('AC-001.4', () => {
  test("AC-001.4.34: keeps entered values and reuses the saved ID on subsequent saves (also AC-001.5)", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    render(<EventRequestForm />)
    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Dinner' } })
    saveDraft()
    await screen.findByText('Draft saved')
    expect(screen.getByLabelText('Event name')).toHaveValue('Dinner')
    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Lunch' } })
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument()
    saveDraft()
    await screen.findByText('Draft saved')
    expect(mocks.saveEventDraft).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Lunch' }), 'draft-1')
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
  })
})

describe('AC-001.5', () => {
  test("AC-001.5.4: disables editing and both actions while a save is pending", async () => {
    let finish!: (value: SaveEventDraftResult) => void
    mocks.saveEventDraft.mockReturnValue(new Promise<SaveEventDraftResult>((resolve) => { finish = resolve }))
    render(<EventRequestForm />)
    saveDraft()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /submit event request/i })).toBeDisabled()
    expect(screen.getByLabelText('Event name')).toBeDisabled()
    submit()
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
    finish(savedDraft)
    await screen.findByText('Draft saved')
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled()
    expect(mocks.saveEventDraft).toHaveBeenCalledTimes(1)
  })
})

describe('AC-001.6', () => {
  test("AC-001.6.2: explicit submission uses the saved ID and resets it after success", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    mocks.submitEventRequest.mockResolvedValue(success)
    render(<EventRequestForm />)
    saveDraft()
    await screen.findByText('Draft saved')
    fillRequiredFields()
    submit()
    expect(await screen.findByText('Your event request was submitted')).toBeInTheDocument()
    expect(mocks.submitEventRequest).toHaveBeenCalledWith(expect.objectContaining({ expectedAttendance: '120' }), 'draft-1')
    expect(screen.queryByText('Draft', { exact: true })).not.toBeInTheDocument()
    saveDraft()
    await screen.findByText('Draft saved')
    expect(mocks.saveEventDraft).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: '' }), undefined)
  })

  test("AC-001.6.3: a saved incomplete draft still cannot be submitted", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    render(<EventRequestForm />)
    saveDraft()
    await screen.findByText('Draft saved')
    submit()
    await screen.findByText('Purpose is required.')
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
  })

  test("AC-001.6.4: failed submission preserves the draft ID for further editing", async () => {
    mocks.saveEventDraft.mockResolvedValue(savedDraft)
    mocks.submitEventRequest.mockRejectedValue(new Error('Offline'))
    render(<EventRequestForm />)
    saveDraft()
    await screen.findByText('Draft saved')
    fillRequiredFields()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unreachable.')
    saveDraft()
    await screen.findByText('Draft saved')
    expect(mocks.saveEventDraft).toHaveBeenLastCalledWith(expect.objectContaining({ expectedAttendance: '120' }), 'draft-1')
  })
})

describe('AC-002.1', () => {
  test('AC-002.1.6: offers an input for every piece of preliminary information', () => {
    render(<EventRequestForm />)
    for (const label of [
      /purpose of the event/i,
      /type of event/i,
      /preferred start/i,
      /preferred end/i,
      /expected number of attendees/i,
      /general programme/i,
      /room layout preference/i,
      /accessibility requirements/i,
      /equipment requirements/i,
      /attendees must register/i,
      /other special arrangements/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
})

describe('AC-002.2', () => {
  test('AC-002.2.19: does not submit when a required field is missing, and says which', async () => {
    render(<EventRequestForm />)
    submit()
    expect(await screen.findByText(/purpose is required/i)).toBeInTheDocument()
    expect(mocks.submitEventRequest).not.toHaveBeenCalled()
  })
})

describe('AC-002.3', () => {
  test('AC-002.3.1: informs the organiser of a successful submission and its reference', async () => {
    mocks.submitEventRequest.mockResolvedValue(success)
    render(<EventRequestForm />)
    fillRequiredFields()
    submit()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Your event request was submitted')
    expect(banner).toHaveTextContent('EVT-2026-0042')
    expect(banner).toHaveTextContent('In review')
  })

  test('AC-002.3.2: clears the form after a successful submission so the next request starts clean', async () => {
    mocks.submitEventRequest.mockResolvedValue(success)
    render(<EventRequestForm />)
    fillRequiredFields()
    submit()
    await screen.findByRole('status')
    await waitFor(() => {
      expect(screen.getByLabelText(/purpose of the event/i)).toHaveValue('')
    })
  })
})

describe('AC-002.4', () => {
  test('AC-002.4.9: informs the organiser of a failed submission with the reason', async () => {
    mocks.submitEventRequest.mockResolvedValue({
      ok: false,
      reason: 'You must be signed in as an event organiser to submit a request.',
      issues: [],
    } satisfies SubmitEventRequestResult)
    render(<EventRequestForm />)
    fillRequiredFields()
    submit()
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Your event request was not submitted')
    expect(banner).toHaveTextContent(/must be signed in as an event organiser/i)
  })
})