import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { ArrangementReviewPanel } from '../components/ArrangementReviewPanel'
import { ArrangementResolutionForm } from '../components/ArrangementResolutionForm'
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }))
vi.mock('../arrangementReviewService', () => ({
  listArrangementReviews: mocks.read, resolveArrangementReview: mocks.save,
  ARRANGEMENT_RESOLUTION_MESSAGES: { invalid: 'Choose a resolution and explain.', failed: 'Refresh before retrying.' },
}))
const first = { id: '41000000-0000-0000-0000-000000000001', venue_booking_id: 'booking', equipment_booking_id: null,
  detail: 'Capacity needs review', created_at: '2026-10-13T01:00:00Z', status: 'open', venue_booking: { venue: { name: 'Hall A' } } }
beforeEach(() => vi.resetAllMocks())
test('AC-041.6.3: resolves individual reasons using both methods, keeps other reasons open and displays retained history', async () => {
  const user = userEvent.setup()
  const second = { ...first, id: '41000000-0000-0000-0000-000000000002', detail: 'Timing needs review' }
  let rows = [first, second]
  mocks.read.mockImplementation(async () => ({ ok: true, value: rows }))
  mocks.save.mockImplementation(async (id: string, method: string, note: string) => {
    rows = rows.map(row => row.id === id ? { ...row, status: 'resolved', resolution: note, resolution_method: method,
      resolved_at: '2026-10-13T02:00:00Z', resolved_by: 'coordinator', resolver: { full_name: 'Jaydon' } } : row)
    return { ok: true }
  })
  const onCount = vi.fn()
  render(<ArrangementReviewPanel eventId="event" onCount={onCount} />)
  await screen.findByText('Capacity needs review')
  for (const [method, label, note] of [['corrected', 'Arrangement corrected', 'Changed to the larger room.'], ['confirmed_valid', 'Still valid', 'Reserved timing already covers this session.']]) {
    const form = screen.getAllByRole('form', { name: 'Resolve review reason' })[0]
    await user.selectOptions(within(form).getByLabelText('Resolution'), method)
    await user.type(within(form).getByLabelText('Explanation'), note)
    await user.click(within(form).getByRole('button', { name: 'Save resolution' }))
    const history = await screen.findByRole('region', { name: 'Resolution history' })
    expect(await within(history).findByText(`Resolved — ${label}`)).toBeInTheDocument()
    expect(within(history).getByText(note)).toBeInTheDocument()
    expect(within(history).getAllByText(/Jaydon · 13 Oct 2026, 10:00/).length).toBeGreaterThan(0)
    if (method === 'corrected') {
      expect(screen.getAllByRole('form')).toHaveLength(1)
      expect(screen.getByText('Needs review')).toBeInTheDocument()
      await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
    }
  }
  expect(await screen.findByText('No arrangements are currently flagged for review.')).toBeInTheDocument()
  await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
  expect(mocks.save.mock.calls.map(call => call[0])).toEqual([first.id, second.id])
})
test('AC-041.6.4: requires explanation, blocks duplicate submits and preserves input on errors without claiming success', async () => {
  const user = userEvent.setup()
  const saved = vi.fn()
  render(<ArrangementResolutionForm flagId={first.id} onResolved={saved} />)
  await user.click(screen.getByRole('button', { name: 'Save resolution' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a resolution and explain.')
  await user.selectOptions(screen.getByLabelText('Resolution'), 'corrected')
  await user.type(screen.getByLabelText('Explanation'), '   ')
  await user.click(screen.getByRole('button', { name: 'Save resolution' }))
  expect(mocks.save).not.toHaveBeenCalled()
  await user.clear(screen.getByLabelText('Explanation'))
  await user.type(screen.getByLabelText('Explanation'), 'Rebooked the room.')
  let finish!: (result: unknown) => void
  mocks.save.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const form = screen.getByRole('form')
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Saving resolution…' })).toBeDisabled()
  await act(async () => { finish({ ok: false, reason: 'Already resolved; refresh.' }) })
  expect(screen.getByRole('alert')).toHaveTextContent('Already resolved; refresh.')
  expect(screen.getByLabelText('Explanation')).toHaveValue('Rebooked the room.')
  expect(saved).not.toHaveBeenCalled()
  mocks.save.mockRejectedValueOnce(new Error('Offline'))
  await user.click(screen.getByRole('button', { name: 'Save resolution' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh before retrying.')
  expect(saved).not.toHaveBeenCalled()
  mocks.save.mockResolvedValueOnce({ ok: true })
  await user.click(screen.getByRole('button', { name: 'Save resolution' }))
  expect(saved).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Save resolution' })).toBeDisabled()
})
