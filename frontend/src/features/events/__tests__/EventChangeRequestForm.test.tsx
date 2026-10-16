import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EventChangeRequestForm } from '../components/EventChangeRequestForm'
import { eventId } from './fixtures/changeRequestReview'

/**
 * Form-level coverage for US6, grouped by acceptance criterion.
 *
 * The service owns the same rules and has its own cases; these check that the organiser
 * is stopped before a pointless round trip and told what to fix. The catalogue service is
 * mocked so the requirement controls have real options to tick — without it the lists
 * load from Supabase and the layout and equipment groups come back empty.
 */

const mocks = vi.hoisted(() => ({ request: vi.fn(), catalogue: vi.fn() }))

vi.mock('../eventChangeRequestService', () => ({
  requestEventChange: mocks.request,
  CHANGE_REQUEST_MESSAGES: {
    reasonRequired: 'Please explain why you are requesting this change.',
    noChangesProposed: 'Please propose at least one change.',
    unexpected: 'Something went wrong submitting your change request. Please try again.',
  },
}))

vi.mock('../requirementCatalogueService', () => ({
  loadRequirementCatalogue: mocks.catalogue,
  REQUIREMENT_CATALOGUE_MESSAGES: {
    unavailable: 'The requirement options could not be loaded. Please reload the page.',
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.catalogue.mockResolvedValue({
    ok: true,
    catalogue: {
      layouts: [
        { code: 'theatre', label: 'Theatre' },
        { code: 'banquet', label: 'Banquet (rounds)' },
      ],
      accessibility: [
        { code: 'wheelchair_access', label: 'Wheelchair access' },
        { code: 'lift_access', label: 'Lift access' },
      ],
      facilities: [{ code: 'projector', label: 'Projector' }],
      equipment: [{ code: 'wireless_mic', label: 'Wireless mic' }],
    },
  })
})

function setup(current?: Parameters<typeof EventChangeRequestForm>[0]['current']) {
  render(<EventChangeRequestForm eventId={eventId} current={current} />)
  return userEvent.setup()
}

describe('AC-006.4 — the form proposes new values without applying them', () => {
  test('AC-006.4.5: a reason with no proposed field changes is refused before calling the service', async () => {
    const user = setup()
    await user.type(screen.getByLabelText(/Reason for this change/), 'Testing only.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(await screen.findByText('Please propose at least one change.')).toBeInTheDocument()
    expect(mocks.request).not.toHaveBeenCalled()
  })

  test('AC-006.4.6: only the fields the organiser actually filled in are sent, alongside the reason', async () => {
    mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
    const user = setup()
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(mocks.request).toHaveBeenCalledWith(eventId, { name: 'New name' }, 'Sponsor renamed the event.')
  })

  test('AC-006.4.7: ticking a requirement proposes it as a code list, not as text', async () => {
    // End to end through the real controls: the point of the whole change is that a
    // requirement leaves this form as a catalogue code a venue can be matched against.
    mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
    const user = setup()
    await user.click(await screen.findByLabelText('Wheelchair access'))
    await user.type(screen.getByLabelText(/Reason for this change/), 'Attendee needs access.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(mocks.request).toHaveBeenCalledWith(
      eventId,
      { accessibilityRequirements: ['wheelchair_access'] },
      'Attendee needs access.',
    )
  })

  test('AC-006.4.8: an untouched prefilled control proposes nothing even once another field changes', async () => {
    // Boundary between the two kinds of field: the prefilled controls must not be read as
    // proposals simply because the organiser submitted the form.
    mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
    const user = setup({
      layoutPreference: 'theatre',
      accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'],
      equipmentRequirements: ['wireless_mic'],
    })
    await screen.findByLabelText('Wheelchair access')
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.type(screen.getByLabelText(/Reason for this change/), 'Rename only.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(mocks.request).toHaveBeenCalledWith(eventId, { name: 'New name' }, 'Rename only.')
  })
})

describe('AC-006.5 — the organiser must give a reason', () => {
  test('AC-006.5.5: submitting with no fields filled in and no reason is blocked', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(screen.getByText('Please explain why you are requesting this change.')).toBeInTheDocument()
    expect(mocks.request).not.toHaveBeenCalled()
  })

  test('AC-006.5.6: a proposed field with no reason is blocked by the reason requirement, not treated as valid', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(screen.getByText('Please explain why you are requesting this change.')).toBeInTheDocument()
    expect(mocks.request).not.toHaveBeenCalled()
  })
})

describe('AC-006.6 — the request is submitted for review', () => {
  test('AC-006.6.4: a successful submission confirms and clears the form for another request', async () => {
    mocks.request.mockResolvedValue({ ok: true, requestId: 'change-1' })
    const user = setup()
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(await screen.findByText('Your change request has been submitted for review.')).toBeInTheDocument()
    expect(screen.getByLabelText('Event name')).toHaveValue('')
  })

  test('AC-006.6.5: a refused submission shows the service reason and keeps what was typed', async () => {
    mocks.request.mockResolvedValue({ ok: false, reason: 'A change request for this event is already pending review.' })
    const user = setup()
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(await screen.findByText('A change request for this event is already pending review.')).toBeInTheDocument()
    expect(screen.getByLabelText('Event name')).toHaveValue('New name')
  })

  test('AC-006.6.6: a thrown error is reported rather than leaving the organiser waiting', async () => {
    // Failure case the two above do not cover: the service rejecting rather than returning
    // ok: false. Without this the form could hang on a network fault.
    mocks.request.mockRejectedValue(new Error('Offline'))
    const user = setup()
    await user.type(screen.getByLabelText('Event name'), 'New name')
    await user.type(screen.getByLabelText(/Reason for this change/), 'Sponsor renamed the event.')
    await user.click(screen.getByRole('button', { name: 'Submit change request' }))
    expect(await screen.findByText(/Something went wrong submitting your change request/)).toBeInTheDocument()
    expect(screen.getByLabelText('Event name')).toHaveValue('New name')
  })

  test('AC-006.6.7: an unavailable requirement catalogue is reported instead of offering empty lists', async () => {
    // Without the catalogues the organiser cannot choose a layout or tick equipment, so
    // silently rendering empty groups would look like "this event needs nothing".
    mocks.catalogue.mockResolvedValue({
      ok: false,
      catalogue: { layouts: [], accessibility: [], facilities: [], equipment: [] },
      reason: 'The requirement options could not be loaded. Please reload the page.',
    })
    setup()
    expect(await screen.findByText(/requirement options could not be loaded/)).toBeInTheDocument()
  })
})
