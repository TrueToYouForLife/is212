import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ChangeRequestList } from '../components/ChangeRequestList'
import { changeRequest, eventId } from './fixtures/changeRequestReview'

const mocks = vi.hoisted(() => ({ load: vi.fn(), withdraw: vi.fn(), reply: vi.fn() }))
vi.mock('../eventChangeRequestService', () => ({ getMyChangeRequests: mocks.load, withdrawChangeRequest: mocks.withdraw }))
vi.mock('../changeRequestReplyService', () => ({ saveChangeRequestReply: mocks.reply, CHANGE_REPLY_SERVICE_MESSAGES: { failed: 'Reload.' } }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue([changeRequest])
})
function setup() {
  render(<ChangeRequestList eventId={eventId} organiserId="owner" currentUserId="owner" />)
  return userEvent.setup()
}

// AC-006.7 — the organiser can see where a request stands. The statuses named in the
// criterion are pending, approved and rejected; the implementation also has withdrawn,
// clarification_requested and partially_approved, which US7 introduced and whose wording
// is covered by the AC-007 cases further down this file. These cases are US6's: they check
// the organiser's own view of their request's state, and that a settled request stops
// offering actions that no longer apply.
test('AC-006.7.1: a request awaiting review reads as in review, with withdrawal still offered', async () => {
  setup()
  expect(await screen.findByText('In review')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument()
})
test('AC-006.7.2: an approved request reads as approved and can no longer be withdrawn', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'approved', reviewedAt: '2026-02-01T00:00:00Z' }])
  setup()
  expect(await screen.findByText('Approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-006.7.3: a rejected request reads as rejected and can no longer be withdrawn', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'rejected', reviewedAt: '2026-02-01T00:00:00Z' }])
  setup()
  expect(await screen.findByText('Rejected')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-006.7.4: a withdrawn request still shows its own outcome rather than disappearing', async () => {
  // Boundary on the three named statuses: the organiser's own withdrawal is an outcome
  // too, and hiding the row would read as the request never having existed.
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'withdrawn' }])
  setup()
  expect(await screen.findByText('Withdrawn')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-006.7.5: an event with no requests says so rather than rendering an empty panel', async () => {
  mocks.load.mockResolvedValue([])
  setup()
  expect(await screen.findByText('No changes have been requested for this event.')).toBeInTheDocument()
})

test('AC-006.8.1: the existing owner withdrawal action still sends the selected request and reloads', async () => {
  mocks.withdraw.mockResolvedValue({ ok: true })
  const user = setup()
  await user.click(await screen.findByRole('button', { name: 'Withdraw request' }))
  expect(mocks.withdraw).toHaveBeenCalledWith(changeRequest.id)
  expect(mocks.load).toHaveBeenCalledTimes(2)
})
test('AC-006.8.2: a refused withdrawal displays its reason instead of silently failing', async () => {
  mocks.withdraw.mockResolvedValue({ ok: false, reason: 'This request has already been reviewed.' })
  const user = setup()
  await user.click(await screen.findByRole('button', { name: 'Withdraw request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('already been reviewed')
})
test('AC-006.8.7: only the owning organiser is offered the withdrawal control', async () => {
  // Hiding it from everyone else is a courtesy; the service's own cases prove a direct
  // call from another account is refused.
  render(<ChangeRequestList eventId={eventId} organiserId="owner" currentUserId="someone-else" />)
  expect(await screen.findByText('In review')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-007.6.7: the organiser sees the reason attached to a rejected field', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'partially_approved', fieldDecisions: [
    { field: 'expectedAttendance', decision: 'rejected', note: 'The room capacity is 50.' },
  ] }])
  setup()
  expect(await screen.findByText('The room capacity is 50.')).toBeInTheDocument()
  expect(screen.getByText('Partially approved')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
})
test('AC-007.7.34: the organiser sees separate questions and provisional decisions without review controls', async () => {
  mocks.load.mockResolvedValue([{ ...changeRequest, status: 'clarification_requested', fieldDecisions: [
    { field: 'name', decision: 'approved', note: null },
    { field: 'expectedAttendance', decision: 'clarification_requested', note: 'Does this include staff?' },
  ] }])
  setup()
  expect(await screen.findByText('Does this include staff?')).toBeInTheDocument()
  expect(screen.getByText('Approved provisionally')).toBeInTheDocument()
  expect(screen.getByText(/No proposed changes have been applied/)).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})
test('AC-007.7.35: failed loading cannot hide questions behind an empty-list message and can be retried', async () => {
  mocks.load.mockRejectedValueOnce(new Error('Offline'))
  const user = setup()
  await screen.findByRole('alert')
  expect(screen.queryByText('No changes have been requested for this event.')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry loading change requests' }))
  expect(await screen.findByText('In review')).toBeInTheDocument()
})

const awaitingReply = { ...changeRequest, status: 'clarification_requested' as const, reviewVersion: 1, fieldDecisions: [
  { field: 'name' as const, decision: 'approved' as const, note: '' },
  { field: 'expectedAttendance' as const, decision: 'clarification_requested' as const, note: 'Includes staff?' },
] }
test('AC-007.7.75: only the owning organiser sees the reply controls', async () => {
  mocks.load.mockResolvedValue([awaitingReply])
  render(<ChangeRequestList eventId={eventId} organiserId="owner" currentUserId="someone-else" />)
  await screen.findByText('Includes staff?')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('AC-007.7.76: sending replies reloads status and removes the completed reply form', async () => {
  mocks.load.mockResolvedValueOnce([awaitingReply]).mockResolvedValue([changeRequest])
  mocks.reply.mockResolvedValue({ ok: true, status: 'submitted' })
  const user = setup()
  await user.type(await screen.findByRole('textbox'), 'Yes.')
  await user.click(screen.getByRole('button', { name: 'Send replies for review' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Replies sent for review')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(mocks.load).toHaveBeenCalledTimes(2)
})
test('AC-007.7.77: focus preserves answers and manual reload replaces the displayed questions', async () => {
  mocks.load.mockResolvedValue([awaitingReply])
  const user = setup()
  await user.type(await screen.findByRole('textbox'), 'Still typing')
  fireEvent.focus(window)
  expect(mocks.load).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('textbox')).toHaveValue('Still typing')
  await user.click(screen.getByRole('button', { name: 'Reload change requests' }))
  expect(await screen.findByRole('textbox')).toHaveValue('')
  expect(mocks.load).toHaveBeenCalledTimes(2)
})
