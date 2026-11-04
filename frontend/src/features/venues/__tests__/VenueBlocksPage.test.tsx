import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { VenueBlocksPage } from '../pages/VenueBlocksPage'

const mocks = vi.hoisted(() => ({
  role: 'venue_staff',
  loading: false,
  listVenues: vi.fn(),
  listBlocks: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../../auth/sessionContext', () => ({
  useCurrentUser: () => ({ loading: mocks.loading, profile: { id: 'staff-1', role: mocks.role } }),
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
  mocks.loading = false
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

test('venue list failures are shown instead of silently presenting an empty list', async () => {
  mocks.listVenues.mockResolvedValue({ ok: false, reason: 'Venues unavailable' })
  render(<VenueBlocksPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Venues unavailable')
})

test('block failures clear old blocks and selecting a venue again recovers', async () => {
  await chooseVenue()
  mocks.listBlocks.mockResolvedValueOnce({ ok: false, reason: 'Blocks unavailable' })
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '' } })
  expect(screen.queryByText('Ceiling repair')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: 'v1' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Blocks unavailable')
  expect(screen.queryByText('Ceiling repair')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: 'v1' } })
  expect(await screen.findByText('Ceiling repair')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('venues without a location retain their name', async () => {
  mocks.listVenues.mockResolvedValue({ ok: true, value: [{ id: 'v1', name: 'Main Hall', location: null }] })
  render(<VenueBlocksPage />)
  expect(await screen.findByRole('option', { name: 'Main Hall' })).toHaveValue('v1')
})

test('session loading shows no block controls', () => {
  mocks.loading = true
  mocks.role = ''
  render(<VenueBlocksPage />)
  expect(screen.queryByLabelText('Venue')).not.toBeInTheDocument()
  expect(mocks.listVenues).not.toHaveBeenCalled()
})

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

    fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: '2040-04-01' } })
    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: '2040-04-01' } })
    fireEvent.change(screen.getByLabelText(/Start time/), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Deep clean' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ venueId: 'v1', reason: 'Deep clean' }))
    await waitFor(() => expect(mocks.listBlocks).toHaveBeenCalledTimes(2))
  })
})
