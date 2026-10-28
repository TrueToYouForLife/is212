import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueBlockForm } from '../components/VenueBlockForm'
import type { VenueBlockInput, VenueBlockPreview } from '../venueBlockTypes'
import { BLOCK_VALIDATION_MESSAGES } from '../venueBlockValidation'

const NOTHING: VenueBlockPreview = { affectedBookings: [], existingBlocks: [] }

const ENTERED: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-10',
  slots: [], startTime: '09:00', endTime: '09:15',
  reason: 'Ceiling repair',
}

const previewing = (value: VenueBlockPreview = NOTHING) => vi.fn().mockResolvedValue({ ok: true, value })
const saving = (flaggedBookings: number | null = 0) =>
  vi.fn().mockResolvedValue({ ok: true, value: { blockId: 'block-1', flaggedBookings } })

function fillIn(reason = ENTERED.reason) {
  fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: ENTERED.startsOn } })
  fireEvent.change(screen.getByLabelText(/End date/), { target: { value: ENTERED.endsOn } })
  fireEvent.change(screen.getByLabelText(/Start time/), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '09:15' } })
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: reason } })
}

describe('AC-012.3 — a reason is required', () => {
  test('AC-012.3.7: a blank reason shows its message beside the field, and nothing is previewed', async () => {
    const onPreview = previewing()
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={saving()} />)

    fillIn('   ')
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(BLOCK_VALIDATION_MESSAGES.reasonRequired)
    expect(onPreview).not.toHaveBeenCalled()
  })
})

describe('AC-012.7 — overlaps are previewed before saving', () => {
  test('AC-012.7.12: Confirm block appears only after a preview, and confirms what was previewed', async () => {
    const onPreview = previewing()
    const onCreate = saving()
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={onCreate} />)

    fillIn()
    expect(screen.queryByRole('button', { name: 'Confirm block' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))

    expect(onPreview).toHaveBeenCalledWith(ENTERED)
    expect(onCreate).toHaveBeenCalledWith(ENTERED)
  })
})

describe('AC-012.7 — what the preview shows, and when it still counts', () => {
  test('AC-012.7.13: changing the dates or slots after previewing hides Confirm until previewed again', async () => {
    render(<VenueBlockForm venueId="v1" onPreview={previewing()} onCreate={saving()} />)

    fillIn()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('button', { name: 'Confirm block' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: '2040-03-11' } })
    expect(screen.queryByRole('button', { name: 'Confirm block' })).toBeNull()
  })

  test('AC-012.7.14: the preview lists each affected booking and says it will be flagged, not cancelled', async () => {
    const onPreview = previewing({
      affectedBookings: [{
        bookingId: 'b1',
        status: 'confirmed',
        eventReference: 'EVT-1',
        eventName: 'Gala',
        cells: [{ date: '2040-03-10', slot: 'T0900', kind: 'event' }],
      }],
      existingBlocks: [],
    })
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={saving()} />)

    fillIn()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(await screen.findByText(/1 booking will be flagged for review/)).toHaveTextContent(/not cancelled/)
    expect(screen.getByText('EVT-1')).toBeInTheDocument()
  })
})

describe('AC-012.9 — an existing block must be removed first', () => {
  test('AC-012.9.17: a block overlapping an existing block cannot be confirmed, and the preview says why', async () => {
    const onPreview = previewing({
      affectedBookings: [],
      existingBlocks: [{ date: '2040-03-10', slot: 'T0900', reason: 'Deep clean' }],
    })
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={saving()} />)

    fillIn()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(await screen.findByRole('button', { name: 'Confirm block' })).toBeDisabled()
    expect(screen.getByText(/Deep clean/)).toBeInTheDocument()
  })
})

describe('AC-012.8 — overlapping bookings are flagged and their coordinators told', () => {
  test('AC-012.8.16: after saving, the form says how many bookings were flagged, then clears', async () => {
    const onSaved = vi.fn()
    render(<VenueBlockForm venueId="v1" onPreview={previewing()} onCreate={saving(2)} onSaved={onSaved} />)

    fillIn()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))

    expect(await screen.findByRole('status')).toHaveTextContent('2 bookings were flagged for review')
    expect(onSaved).toHaveBeenCalled()
    expect(screen.getByLabelText(/Reason/)).toHaveValue('')
  })
})

describe('AC-012.2 — a refused block is explained', () => {
  test('AC-012.2.28: a problem the service reports is shown, and nothing can be confirmed', async () => {
    const onPreview = vi.fn().mockResolvedValue({ ok: false, reason: 'Only Venue Staff can block or unblock a venue.' })
    render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={saving()} />)

    fillIn()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only Venue Staff can block or unblock a venue.')
    expect(screen.queryByRole('button', { name: 'Confirm block' })).toBeNull()
  })
})

test('AC-048.2.6: continuous block uses start/end dates and times, allows overnight, refuses reversed instants and invalidates changed previews', async () => {
  const onPreview = previewing()
  const onCreate = saving()
  render(<VenueBlockForm venueId="v1" onPreview={onPreview} onCreate={onCreate} />)
  fillIn()
  for (const end of ['09:00', '08:45']) {
    fireEvent.change(screen.getByLabelText(/End time/), { target: { value: end } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('End date and time must be after start date and time')
    expect(onPreview).not.toHaveBeenCalled()
  }
  fireEvent.change(screen.getByLabelText(/End date/), { target: { value: '2040-03-11' } })
  fireEvent.change(screen.getByLabelText(/Start time/), { target: { value: '21:00' } })
  fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '08:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  await screen.findByRole('button', { name: 'Confirm block' })
  expect(onPreview).toHaveBeenLastCalledWith({ ...ENTERED, endsOn: '2040-03-11', startTime: '21:00', endTime: '08:00' })
  fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '08:15' } })
  expect(screen.queryByRole('button', { name: 'Confirm block' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm block' }))
  expect(onCreate).toHaveBeenLastCalledWith({ ...ENTERED, endsOn: '2040-03-11', startTime: '21:00', endTime: '08:15' })
  await screen.findByRole('status')
  expect(screen.getByLabelText(/Start time/)).toHaveValue('')
  expect(screen.getByLabelText(/End time/)).toHaveValue('')
  fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: ENTERED.startsOn } })
  fireEvent.change(screen.getByLabelText(/End date/), { target: { value: ENTERED.endsOn } })
  fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: ENTERED.reason } })
  fireEvent.click(screen.getByLabelText('Full day'))
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  await screen.findByRole('button', { name: 'Confirm block' })
  expect(onPreview).toHaveBeenLastCalledWith({ ...ENTERED, startTime: '00:00', endTime: '24:00' })
})
