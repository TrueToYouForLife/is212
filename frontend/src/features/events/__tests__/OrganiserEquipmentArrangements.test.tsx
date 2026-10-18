import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { OrganiserEquipmentArrangements } from '../components/OrganiserEquipmentArrangements'
import { EQUIPMENT_ARRANGEMENTS_ERROR } from '../organiserEquipmentArrangementService'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../organiserEquipmentArrangementService', async importOriginal => ({
  ...await importOriginal<typeof import('../organiserEquipmentArrangementService')>(),
  loadOrganiserEquipmentArrangements: mocks.read,
}))
const eventId = '42710000-0000-0000-0000-000000000001'
const items = [
  { requirement_id: '1', equipment_name: 'Microphone', quantity_requested: 2, quantity_reserved: 2, status: 'reserved' },
  { requirement_id: '2', equipment_name: 'Speaker', quantity_requested: 3, quantity_reserved: 1, status: 'partially_reserved' },
  { requirement_id: '3', equipment_name: 'Projector', quantity_requested: 1, quantity_reserved: 0, status: 'unavailable' },
  { requirement_id: '4', equipment_name: 'Lighting', quantity_requested: 1, quantity_reserved: 0, status: 'pending_review' },
]
beforeEach(() => vi.resetAllMocks())

test('AC-042.2.5: shows equipment names, quantities and all outcomes without presenting pending assessment as unavailable', async () => {
  mocks.read.mockResolvedValue({ ok: true, value: items })
  render(<OrganiserEquipmentArrangements eventId={eventId} />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading equipment arrangements')
  await screen.findByRole('article', { name: 'Microphone' })
  for (const [name, label, quantity] of [
    ['Microphone', 'Reserved', '2 of 2 reserved'], ['Speaker', 'Partially reserved', '1 of 3 reserved'],
    ['Projector', 'Unavailable', '0 of 1 reserved'], ['Lighting', 'Pending review', '0 of 1 reserved'],
  ]) {
    const item = screen.getByRole('article', { name })
    expect(within(item).getByText(label)).toBeInTheDocument()
    expect(item).toHaveTextContent(quantity)
  }
  const pending = screen.getByRole('article', { name: 'Lighting' })
  expect(pending).toHaveTextContent('Awaiting assessment by Technical Support.')
  expect(within(pending).queryByText('Unavailable')).not.toBeInTheDocument()
  expect(mocks.read).toHaveBeenCalledWith(eventId)
})

test('AC-042.2.6: failed refresh clears stale equipment and retry, focus, parent refresh and event changes reload safely', async () => {
  mocks.read.mockResolvedValue({ ok: true, value: items })
  const { rerender } = render(<OrganiserEquipmentArrangements eventId={eventId} />)
  await screen.findByRole('article', { name: 'Microphone' })
  mocks.read.mockResolvedValue({ ok: false, reason: EQUIPMENT_ARRANGEMENTS_ERROR })
  await userEvent.click(screen.getByRole('button', { name: 'Refresh equipment arrangements' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(EQUIPMENT_ARRANGEMENTS_ERROR)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.queryByText('No equipment arrangements have been recorded yet.')).not.toBeInTheDocument()
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('No equipment arrangements have been recorded yet.')
  mocks.read.mockResolvedValue({ ok: true, value: [items[0]] })
  fireEvent.focus(window)
  await screen.findByRole('article', { name: 'Microphone' })
  mocks.read.mockResolvedValue({ ok: true, value: [items[1]] })
  rerender(<OrganiserEquipmentArrangements eventId={eventId} refreshVersion={1} />)
  await screen.findByRole('article', { name: 'Speaker' })
  expect(screen.queryByRole('article', { name: 'Microphone' })).not.toBeInTheDocument()
  mocks.read.mockResolvedValue({ ok: true, value: [] })
  const nextId = '42710000-0000-0000-0000-000000000002'
  rerender(<OrganiserEquipmentArrangements eventId={nextId} />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  await waitFor(() => expect(mocks.read).toHaveBeenLastCalledWith(nextId))
  await screen.findByText('No equipment arrangements have been recorded yet.')
})
