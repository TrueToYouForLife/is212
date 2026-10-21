import { act, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ReplacementProposalForm } from '../components/ReplacementProposalForm'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { VenueReplacementPanel } from '../components/VenueReplacementPanel'
import { replacementFixture, replacementIds as ids } from './venueReplacementFixtures'
const render = (element: ReactElement) => rtlRender(<MemoryRouter>{element}</MemoryRouter>)
const proposal = () => <ReplacementProposalForm source={replacementFixture.sources[0]}
  target={{ ...replacementFixture.venues[0], status: 'active', layout: 'theatre', accessibility: [], facility: {} }} onBack={() => {}} />
const mocks = vi.hoisted(() => ({ load: vi.fn(), propose: vi.fn(), decide: vi.fn() }))
vi.mock('../venueReplacementService', () => ({ getVenueReplacements: mocks.load, proposeVenueReplacement: mocks.propose, decideVenueReplacement: mocks.decide }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, value: structuredClone(replacementFixture) })
  mocks.propose.mockResolvedValue({ ok: true }); mocks.decide.mockResolvedValue({ ok: true })
})
test('AC-020.3.50: coordinator proposes an alternative with a reason and sees the original-preservation message', async () => {
  render(proposal())
  await userEvent.type(screen.getByLabelText('Reason and proposed arrangement'), 'Discussed alternative')
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(mocks.propose).toHaveBeenCalledWith(ids.source, ids.target, 'source-v1', 'Discussed alternative')
  expect(await screen.findByRole('status')).toHaveTextContent('original booking remains in place')
  expect(screen.queryByRole('button', { name: 'Approve replacement' })).not.toBeInTheDocument()
})
test('AC-020.3.51: Venue Staff see current requirements and approve with a recorded note', async () => {
  const onChanged = vi.fn()
  render(<VenueReplacementPanel role="venue_staff" onChanged={onChanged} />)
  await userEvent.type(await screen.findByLabelText('Decision note (required)'), 'Checked and agreed')
  expect(screen.getByText(/Requested layout: theatre/)).toHaveTextContent('wifi')
  expect(screen.queryByRole('button', { name: 'Propose replacement' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Approve replacement' }))
  expect(mocks.decide).toHaveBeenCalledWith(ids.request, 'review-v1', 'approved', 'Checked and agreed')
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
})
test('AC-020.3.52: rejection and coordinator withdrawal use their distinct decision actions', async () => {
  const view = render(<VenueReplacementPanel role="venue_staff" />)
  await userEvent.type(await screen.findByLabelText('Decision note (required)'), 'Not agreed')
  await userEvent.click(screen.getByRole('button', { name: 'Reject replacement' }))
  expect(mocks.decide).toHaveBeenCalledWith(ids.request, 'review-v1', 'rejected', 'Not agreed')
  view.unmount()
  render(<VenueReplacementPanel role="coordinator" />)
  await userEvent.type(await screen.findByLabelText('Decision note (required)'), 'Choose another')
  await userEvent.click(screen.getByRole('button', { name: 'Withdraw proposal' }))
  expect(mocks.decide).toHaveBeenCalledWith(ids.request, 'review-v1', 'withdrawn', 'Choose another')
})
test('AC-020.3.53: stale source disables approval but allows rejection with an explanation', async () => {
  const value = structuredClone(replacementFixture); value.requests[0].sourceChanged = true
  mocks.load.mockResolvedValue({ ok: true, value })
  render(<VenueReplacementPanel role="venue_staff" />)
  expect(await screen.findByRole('button', { name: 'Approve replacement' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reject replacement' })).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('submit a fresh one')
})
test('AC-020.3.54: conflicts keep the decision note and do not report success', async () => {
  mocks.decide.mockResolvedValue({ ok: false, reason: 'Target is now occupied' })
  const onChanged = vi.fn()
  render(<VenueReplacementPanel role="venue_staff" onChanged={onChanged} />)
  await userEvent.type(await screen.findByLabelText('Decision note (required)'), 'Keep this note')
  await userEvent.click(screen.getByRole('button', { name: 'Approve replacement' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('occupied')
  expect(screen.getByLabelText('Decision note (required)')).toHaveValue('Keep this note')
  expect(onChanged).not.toHaveBeenCalled()
})
test('AC-020.3.55: a pending decision disables actions and sends only one request', async () => {
  let finish!: (value: { ok: true }) => void
  mocks.decide.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<VenueReplacementPanel role="venue_staff" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Approve replacement' }))
  expect(screen.getByRole('button', { name: 'Reject replacement' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Approve replacement' }))
  expect(mocks.decide).toHaveBeenCalledOnce()
  await act(async () => finish({ ok: true }))
})
test('AC-020.3.56: failed proposal preserves selections and text for correction', async () => {
  mocks.propose.mockResolvedValue({ ok: false, reason: 'Choose a valid booking' })
  render(proposal())
  await userEvent.type(await screen.findByLabelText('Reason and proposed arrangement'), 'Keep proposal')
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('valid booking')
  expect(screen.getByLabelText('Reason and proposed arrangement')).toHaveValue('Keep proposal')
})
test('AC-020.3.57: load failure is distinct from an empty queue and reload recovers', async () => {
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Unavailable' }).mockResolvedValue({ ok: true, value: { sources: [], venues: [], requests: [] } })
  render(<VenueReplacementPanel role="coordinator" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  expect(screen.queryByText('No replacement requests.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reload replacements' }))
  expect(await screen.findByText('No replacement requests.')).toBeInTheDocument()
  expect(screen.getByText(/No affected bookings/)).toBeInTheDocument()
})
test('AC-020.3.58: approved history retains staff attribution and the replacement booking link', async () => {
  const value = structuredClone(replacementFixture)
  Object.assign(value.requests[0], { status: 'approved', decidedBy: 'Venue Reviewer', decidedAt: '2026-10-18T02:00:00Z',
    decisionNote: 'Agreed alternative', replacementBookingId: ids.replacement })
  render(<VenueReplacementPanel role="coordinator" />)
  mocks.load.mockResolvedValue({ ok: true, value })
  await screen.findByRole('button', { name: 'Withdraw proposal' })
  await userEvent.click(screen.getByRole('button', { name: 'Reload replacements' }))
  expect(await screen.findByText(/Decision by Venue Reviewer/)).toHaveTextContent('Agreed alternative')
  expect(screen.getByText(/Replacement booking recorded/)).toHaveTextContent(ids.replacement)
  expect(screen.queryByRole('button', { name: 'Withdraw proposal' })).not.toBeInTheDocument()
})

test('AC-020.3.59: late loads are ignored after unmount and a pending proposal prevents duplicate submissions', async () => {
  let finishLoad!: (value: unknown) => void
  mocks.load.mockImplementationOnce(() => new Promise(resolve => { finishLoad = resolve }))
  const view = render(<VenueReplacementPanel role="coordinator" />)
  view.unmount()
  await act(async () => finishLoad({ ok: true, value: replacementFixture }))
  let finishProposal!: (value: { ok: true }) => void
  mocks.propose.mockImplementationOnce(() => new Promise(resolve => { finishProposal = resolve }))
  render(proposal())
  await userEvent.type(screen.getByLabelText('Reason and proposed arrangement'), 'Agreed alternative')
  await userEvent.click(screen.getByRole('button', { name: 'Propose replacement' }))
  expect(screen.getByRole('button', { name: 'Choose another venue' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Sending…' }))
  expect(mocks.propose).toHaveBeenCalledOnce()
  await act(async () => finishProposal({ ok: true }))
})
