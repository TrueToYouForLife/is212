import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SafetyReviewDecisionForm } from '../SafetyReviewDecisionForm'

const mocks = vi.hoisted(() => ({ record: vi.fn() }))
vi.mock('../safetyDecisionService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../safetyDecisionService')>()),
  recordSafetyReviewDecision: mocks.record,
}))

const FACTORS = ['Attendance', 'Venue capacity and layout', 'Emergency access', 'Accessibility', 'Equipment placement', 'Crowd movement', 'Venue restrictions']

function renderForm() {
  const onDecided = vi.fn()
  render(<SafetyReviewDecisionForm eventId="e-1" onDecided={onDecided} />)
  return onDecided
}

function answerAll(concern: 'No concern' | 'Concern' = 'No concern') {
  for (const name of FACTORS) {
    fireEvent.click(within(screen.getByRole('group', { name })).getByRole('radio', { name: concern }))
  }
}

async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Record decision|Saving/ })) })
}

beforeEach(() => mocks.record.mockReset())

describe('AC-044.1 — every factor is assessed', () => {
  test('AC-044.1.4: the form lists the seven factors, and nothing is sent until each is answered and every concern described', async () => {
    renderForm()
    expect(FACTORS.every((name) => screen.getByRole('group', { name }))).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await submit()
    expect(within(screen.getByRole('alert')).getAllByRole('listitem')).toHaveLength(7)
    answerAll()
    fireEvent.click(within(screen.getByRole('group', { name: 'Accessibility' })).getByRole('radio', { name: 'Concern' }))
    expect(screen.getByText('Note for Accessibility (required)')).toBeInTheDocument()
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Describe the concern for Accessibility.')
    expect(mocks.record).not.toHaveBeenCalled()
  })
})

describe('AC-044.2 — reasons are asked for only when needed', () => {
  test('AC-044.2.5: the comment is required and what to revisit is offered for Request changes and Reject, not for Approve', () => {
    renderForm()
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    expect(screen.getByText('Comment')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Revisit' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Reject' }))
    expect(screen.getByText('Comment (required)')).toBeInTheDocument()
    const revisit = screen.getByRole('group', { name: 'Revisit' })
    fireEvent.click(within(revisit).getByRole('checkbox', { name: 'Venue' }))
    fireEvent.click(within(revisit).getByRole('checkbox', { name: 'Venue' }))
    expect(within(revisit).getByRole('checkbox', { name: 'Venue' })).not.toBeChecked()
  })
})

describe('AC-044.3 / AC-044.4 — the decision is recorded', () => {
  test('AC-044.3.2: an approval with every factor answered is recorded and reported', async () => {
    mocks.record.mockResolvedValue({ ok: true, status: 'in_preparation' })
    const onDecided = renderForm()
    answerAll()
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await submit()
    expect(mocks.record).toHaveBeenCalledWith('e-1', expect.objectContaining({ decision: 'approve' }))
    expect(onDecided).toHaveBeenCalledWith('approve')
  })

  test('AC-044.4.3: a change request carries its concerns, comment and what to revisit', async () => {
    mocks.record.mockResolvedValue({ ok: true, status: 'safety_changes_requested' })
    const onDecided = renderForm()
    answerAll()
    const group = screen.getByRole('group', { name: 'Emergency access' })
    fireEvent.click(within(group).getByRole('radio', { name: 'Concern' }))
    fireEvent.change(within(group).getByRole('textbox'), { target: { value: 'Stage blocks the exit' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Request changes' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Comment/ }), { target: { value: 'Move the stage' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Equipment' }))
    await submit()
    const sent = mocks.record.mock.calls[0][1]
    expect(sent).toMatchObject({ decision: 'request_changes', comment: 'Move the stage', revisit: ['equipment'] })
    expect(sent.assessments.emergency_access).toEqual({ concern: true, note: 'Stage blocks the exit' })
    expect(onDecided).toHaveBeenCalledWith('request_changes')
  })
})

describe('AC-044.6 — a refused decision says why', () => {
  test('AC-044.6.5: while saving the button waits; a refusal is shown and nothing is reported as decided', async () => {
    // The save answers after a short delay, so the waiting state can be seen first.
    mocks.record.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, reason: 'This event is no longer awaiting safety review.' }), 20)
    }))
    const onDecided = renderForm()
    answerAll()
    fireEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer awaiting')
    expect(onDecided).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Record decision' })).not.toBeDisabled()
  })
})
