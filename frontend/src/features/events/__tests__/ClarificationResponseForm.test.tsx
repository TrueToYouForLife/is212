import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ClarificationResponseForm } from '../components/ClarificationResponseForm'
import { CLARIFICATION_SERVICE_MESSAGES as messages } from '../clarificationResponseService'
import { CLARIFICATION_MESSAGES } from '../clarificationResponseValidation'
import type { EventRequestDetail } from '../types'

/**
 * US37 — the screen half of AC-037.1, AC-037.2 and AC-037.4 (SCRUM-234).
 *
 * Whether an Organiser may answer at all is settled by 0096 and tested against real RLS in
 * clarification_response.sql. These check the courtesy layer: that the question is shown,
 * that the form is withheld when there is nothing to answer, and that a refusal that cannot
 * be retried does not invite one.
 */

const mocks = vi.hoisted(() => ({ send: vi.fn(), catalogue: vi.fn() }))
vi.mock('../clarificationResponseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../clarificationResponseService')>()),
  sendClarificationResponse: (...args: unknown[]) => mocks.send(...args),
}))
vi.mock('../requirementCatalogueService', () => ({
  REQUIREMENT_CATALOGUE_MESSAGES: { unavailable: 'The requirement options could not be loaded. Please reload the page.' },
  loadRequirementCatalogue: () => mocks.catalogue(),
}))

const returned: EventRequestDetail = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2046-009', organiserId: 'owner', coordinatorId: 'coord',
  name: 'Annual Showcase', purpose: 'Show this year’s work', eventType: 'Showcase',
  proposedStart: '2046-11-01T02:00:00Z', proposedEnd: '2046-11-01T10:00:00Z',
  expectedAttendance: 80, status: 'submitted', submittedAt: '2046-10-01T02:00:00Z',
  description: null, programme: null, layoutPreference: 'theatre',
  accessibilityRequirements: ['hearing_loop'], facilityRequirements: ['projector'],
  equipmentRequirements: [], registrationRequired: false, specialArrangements: null,
  reviewNote: 'Please confirm the expected attendance.',
  reviewedAt: '2046-10-01T01:00:00Z', createdAt: '2046-09-01T02:00:00Z',
  updatedAt: '2046-10-01T01:00:00Z',
}

const catalogue = {
  layouts: [{ code: 'theatre', label: 'Theatre' }, { code: 'banquet', label: 'Banquet' }],
  accessibility: [{ code: 'hearing_loop', label: 'Hearing loop' }],
  facilities: [{ code: 'projector', label: 'Projector' }],
  equipment: [],
}

beforeEach(() => {
  mocks.send.mockReset()
  mocks.catalogue.mockReset().mockResolvedValue({ ok: true, catalogue })
})

describe('AC-037.4 — the form appears only when there is a question', () => {
  test('AC-037.4.13: a returned request shows the question and the reply box', async () => {
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    expect(await screen.findByText('Please confirm the expected attendance.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send reply and resubmit' })).toBeInTheDocument()
  })

  test('AC-037.4.14: a request with no question renders nothing, and fetches nothing', () => {
    const { container } = render(
      <ClarificationResponseForm request={{ ...returned, reviewNote: null }} onSent={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
    // Hooks run before the early return, so this is the assertion that keeps the catalogue
    // from being fetched on every request page an Organiser opens.
    expect(mocks.catalogue).not.toHaveBeenCalled()
  })

  test('AC-037.4.15: no other status offers the form, whatever note it carries', () => {
    for (const status of ['draft', 'under_review', 'approved', 'confirmed', 'rejected'] as const) {
      const { container, unmount } = render(
        <ClarificationResponseForm request={{ ...returned, status }} onSent={vi.fn()} />,
      )
      expect(container).toBeEmptyDOMElement()
      expect(mocks.catalogue).not.toHaveBeenCalled()
      unmount()
    }
  })
})

describe('AC-037.1 — answering', () => {
  test('AC-037.1.30: the reply and the revised values are handed to the service', async () => {
    mocks.send.mockResolvedValue({ ok: true, responseId: 'r1' })
    const onSent = vi.fn()
    render(<ClarificationResponseForm request={returned} onSent={onSent} />)

    await userEvent.type(await screen.findByLabelText('Your reply'), 'It is 140 now.')
    await userEvent.click(screen.getByRole('button', { name: 'Send reply and resubmit' }))

    await waitFor(() => expect(onSent).toHaveBeenCalled())
    expect(mocks.send).toHaveBeenCalledWith(returned, expect.objectContaining({
      reply: 'It is 140 now.',
    }))
    // Seeded from the request as displayed, so the Organiser revises what the Coordinator
    // saw rather than starting from an empty form.
    expect(mocks.send.mock.calls[0][1].values).toMatchObject({
      name: 'Annual Showcase', expectedAttendance: 80, layoutPreference: 'theatre',
    })
  })

  test('AC-037.1.31: a revised field is sent as edited', async () => {
    mocks.send.mockResolvedValue({ ok: true, responseId: 'r1' })
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    await userEvent.type(await screen.findByLabelText('Your reply'), 'Now 140.')
    await userEvent.click(screen.getByText('Revise the request details'))
    const attendance = screen.getByLabelText('Expected attendance')
    await userEvent.clear(attendance)
    await userEvent.type(attendance, '140')
    await userEvent.click(screen.getByRole('button', { name: 'Send reply and resubmit' }))

    await waitFor(() => expect(mocks.send).toHaveBeenCalled())
    expect(mocks.send.mock.calls[0][1].values.expectedAttendance).toBe(140)
  })

  test('AC-037.1.32: a blank reply is reported and nothing is sent twice', async () => {
    mocks.send.mockResolvedValue({ ok: false, reason: CLARIFICATION_MESSAGES.replyRequired })
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Send reply and resubmit' }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent(CLARIFICATION_MESSAGES.replyRequired)
    // Fixable in place, so the form stays open rather than demanding a reload.
    expect(screen.getByRole('button', { name: 'Send reply and resubmit' })).toBeEnabled()
  })

  test('AC-037.1.33: the catalogue failing still leaves a usable form', async () => {
    // A requirement the Organiser cannot see is a requirement they cannot ask for, so the
    // form degrades to the lists that did load instead of refusing to render.
    mocks.catalogue.mockResolvedValue({
      ok: false, reason: 'The requirement options could not be loaded. Please reload the page.',
      catalogue: { ...catalogue, layouts: [] },
    })
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    expect(await screen.findByRole('status'))
      .toHaveTextContent('The requirement options could not be loaded')
    expect(screen.getByLabelText('Your reply')).toBeInTheDocument()
  })
})

describe('AC-037.2 — after the answer is sent', () => {
  test('AC-037.2.12: a sent answer cannot be sent a second time', async () => {
    mocks.send.mockResolvedValue({ ok: true, responseId: 'r1' })
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    await userEvent.type(await screen.findByLabelText('Your reply'), 'Done.')
    const button = screen.getByRole('button', { name: 'Send reply and resubmit' })
    await userEvent.click(button)

    // The request is already back under review, so a second attempt would be refused as
    // not-awaiting-clarification — which reads as a bug rather than as the duplicate it is.
    await waitFor(() => expect(button).toBeDisabled())
    await userEvent.click(button)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  test('AC-037.2.13: a refusal that needs a reload stops accepting the answer', async () => {
    mocks.send.mockResolvedValue({ ok: false, reason: messages.reload })
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    await userEvent.type(await screen.findByLabelText('Your reply'), 'Answering.')
    await userEvent.click(screen.getByRole('button', { name: 'Send reply and resubmit' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.reload)
    expect(screen.getByRole('button', { name: 'Send reply and resubmit' })).toBeDisabled()
  })

  test('AC-037.2.14: an uncertain write is not retried from the screen either', async () => {
    mocks.send.mockRejectedValue(new Error('network'))
    render(<ClarificationResponseForm request={returned} onSent={vi.fn()} />)

    await userEvent.type(await screen.findByLabelText('Your reply'), 'Answering.')
    await userEvent.click(screen.getByRole('button', { name: 'Send reply and resubmit' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.failed)
    expect(screen.getByRole('button', { name: 'Send reply and resubmit' })).toBeDisabled()
  })
})
