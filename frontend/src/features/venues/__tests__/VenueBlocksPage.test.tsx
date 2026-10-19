import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueBlocksPage } from '../pages/VenueBlocksPage'
import { SLOT_LABELS } from '../slotFormat'

const mocks = vi.hoisted(() => ({
  role: 'venue_staff',
  listVenues: vi.fn(),
  listBlocks: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: false, profile: { id: 'staff-1', role: mocks.role } }),
}))
vi.mock('../venueBlockService', () => ({
  listBlockableVenues: mocks.listVenues,
  listVenueBlocks: mocks.listBlocks,
  previewVenueBlock: mocks.preview,
  createVenueBlock: mocks.create,
  removeVenueBlock: mocks.remove,
}))

const BLOCK = {
  id: 'block-1',
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-12',
  slots: ['T0900', 'T1300', 'T2345'],
  reason: 'Ceiling repair',
  createdByName: 'Vera Venue',
  createdAt: '2039-12-05T02:00:00+00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'venue_staff'
  mocks.listVenues.mockResolvedValue({ ok: true, value: [{ id: 'v1', name: 'Main Hall', location: 'Level 2' }] })
  mocks.listBlocks.mockResolvedValue({ ok: true, value: [BLOCK] })
  mocks.preview.mockResolvedValue({ ok: true, value: { affectedBookings: [], existingBlocks: [] } })
  mocks.create.mockResolvedValue({ ok: true, value: { blockId: 'block-2', flaggedBookings: 0 } })
  mocks.remove.mockResolvedValue({ ok: true, value: null })
})

async function chooseVenue() {
  render(<VenueBlocksPage />)
  await screen.findByRole('option', { name: 'Main Hall — Level 2' })
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: 'v1' } })
  await screen.findByText('Ceiling repair')
}

describe('AC-012.1 — only Venue Staff can block', () => {
  test('AC-012.1.9: only Venue Staff can use the venue blocks page', () => {
    mocks.role = 'coordinator'
    render(<VenueBlocksPage />)

    expect(screen.getByText('Blocking venues is available to Venue Staff.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Venue')).toBeNull()
    expect(mocks.listVenues).not.toHaveBeenCalled()
  })
})

describe('AC-012.9 — current blocks can be viewed and removed', () => {
  test('AC-012.9.23: choosing a venue shows its current blocks', async () => {
    await chooseVenue()
    expect(mocks.listBlocks).toHaveBeenCalledWith('v1')
  })

  test('AC-012.9.24: removing a block reloads the current blocks', async () => {
    await chooseVenue()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(mocks.remove).toHaveBeenCalledWith('block-1')
    await waitFor(() => expect(mocks.listBlocks).toHaveBeenCalledTimes(2))
  })

  test('AC-012.9.25: saving a new block on the chosen venue reloads the current blocks', async () => {
    await chooseVenue()

    fireEvent.change(screen.getByLabelText(/First day/), { target: { value: '2040-04-01' } })
    fireEvent.change(screen.getByLabelText(/Last day/), { target: { value: '2040-04-01' } })
    fireEvent.click(screen.getByLabelText(SLOT_LABELS.T0900))
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Deep clean' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'v1', reason: 'Deep clean' }))
    await waitFor(() => expect(mocks.listBlocks).toHaveBeenCalledTimes(2))
  })
})
