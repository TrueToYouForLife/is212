import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { SlotClaimPreview } from '../components/SlotClaimPreview'
import { VenueTimetableGrid } from '../components/VenueTimetableGrid'
import { buildTimetable } from '../venueTimetable'
import { SLOTS } from './fixtures/venueBooking'
import type { ClaimCell } from '../slots'

const CELLS: ClaimCell[] = [
  { date: '2026-10-11', slot: 'NIGHT', kind: 'buffer' },
  { date: '2026-10-12', slot: 'AM', kind: 'event' },
  { date: '2026-10-12', slot: 'PM', kind: 'buffer' },
]

describe('SlotClaimPreview — AC-009.5', () => {
  test('AC-009.5.16: shows each slot and marks which are setup or turnaround', () => {
    render(<SlotClaimPreview cells={CELLS} />)
    expect(screen.getByText('11 Oct 2026 (Night)')).toBeInTheDocument()
    expect(screen.getByText('12 Oct 2026 (AM)')).toBeInTheDocument()
    expect(screen.getAllByText('Setup / turnaround')).toHaveLength(2)
    expect(screen.getAllByText('Event')).toHaveLength(1)
  })
  test('AC-009.2.23: an event outside every slot says so instead of listing nothing', () => {
    render(<SlotClaimPreview cells={[]} />)
    expect(screen.getByText(/outside every bookable slot/)).toBeInTheDocument()
  })
})

describe('BookingStatusBadge — AC-009.9', () => {
  test.each([
    ['AC-009.9.7', 'held', 'Tentatively held'],
    ['AC-009.9.8', 'pending_approval', 'Awaiting Venue Staff'],
    ['AC-009.9.9', 'confirmed', 'Confirmed'],
    ['AC-009.9.10', 'rejected', 'Rejected'],
    ['AC-009.9.11', 'cancelled', 'Released'],
    ['AC-009.9.12', 'expired', 'Expired'],
  ] as const)('%s: %s reads as “%s”', (_id, status, label) => {
    render(<BookingStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('VenueTimetableGrid — AC-011.5', () => {
  const timetable = buildTimetable(SLOTS, [
    { slot_date: '2026-10-12', slot: 'AM', kind: 'event', booking_id: 'b-1',
      booking_status: 'held', event_reference: 'EVT-1', closure_reason: null },
    { slot_date: '2026-10-12', slot: 'PM', kind: 'buffer', booking_id: 'b-1',
      booking_status: 'held', event_reference: 'EVT-1', closure_reason: null },
  ], '2026-10-12', 2)

  test('AC-011.5.14: draws one column per date and one row per display section', () => {
    render(<VenueTimetableGrid timetable={timetable} />)
    expect(screen.getByRole('columnheader', { name: '12 Oct 2026' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '13 Oct 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + AM, PM, Night
  })
  test('AC-011.5.15: a held slot reads as "Tentatively held", its buffer says so too', () => {
    render(<VenueTimetableGrid timetable={timetable} />)
    expect(screen.getByTestId('cell-2026-10-12|AM')).toHaveTextContent('Tentatively held')
    expect(screen.getByTestId('cell-2026-10-12|PM')).toHaveTextContent('Tentatively held (setup/turnaround)')
  })
  test('AC-011.5.16: a free slot reads as available', () => {
    render(<VenueTimetableGrid timetable={timetable} />)
    expect(screen.getByTestId('cell-2026-10-13|AM')).toHaveTextContent('Available')
  })
  test('AC-011.5.17: each cell is announced with its date, slot and state', () => {
    render(<VenueTimetableGrid timetable={timetable} />)
    expect(screen.getByLabelText('12 Oct 2026 AM: Tentatively held')).toBeInTheDocument()
  })
  test('AC-011.5.18: an occupied cell shows whose event holds it', () => {
    render(<VenueTimetableGrid timetable={timetable} />)
    expect(within(screen.getByTestId('cell-2026-10-12|AM')).getByText('EVT-1')).toBeInTheDocument()
  })
  test('AC-009.5.17: the cells a pending selection would take are ringed', () => {
    render(<VenueTimetableGrid timetable={timetable} selectedKeys={new Set(['2026-10-13|AM'])} />)
    expect(screen.getByTestId('cell-2026-10-13|AM').className).toContain('ring-2')
    expect(screen.getByTestId('cell-2026-10-13|PM').className).not.toContain('ring-2')
  })
})

 test('saved booking summary groups adjacent quarters but preserves gaps, roles and dates', () => {
  render(<SlotClaimPreview compact cells={[
    { date: '2026-10-12', slot: 'T1000', kind: 'event' },
    { date: '2026-10-12', slot: 'T1015', kind: 'event' },
    { date: '2026-10-12', slot: 'T1030', kind: 'buffer' },
    { date: '2026-10-12', slot: 'T1100', kind: 'buffer' },
    { date: '2026-10-12', slot: 'T2345', kind: 'event' },
    { date: '2026-10-13', slot: 'T0000', kind: 'event' },
  ]} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
  expect(screen.getByText('12 Oct 2026 (10:00–10:30)')).toBeInTheDocument()
  expect(screen.getByText('12 Oct 2026 (10:30–10:45)')).toBeInTheDocument()
  expect(screen.getByText('12 Oct 2026 (11:00–11:15)')).toBeInTheDocument()
  expect(screen.getByText('12 Oct 2026 (23:45–24:00)')).toBeInTheDocument()
  expect(screen.getByText('13 Oct 2026 (00:00–00:15)')).toBeInTheDocument()
})
