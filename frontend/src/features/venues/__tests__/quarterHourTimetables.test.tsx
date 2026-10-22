import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { VenueTimetableGrid } from '../components/VenueTimetableGrid'
import { VenueAvailabilityGrid } from '../components/VenueAvailabilityGrid'
import { buildTimetable, type TimetableClaimRow } from '../venueTimetable'
import { buildVenueAvailability } from '../venueAvailability'
import { QUARTER_HOUR_SLOTS } from '../quarterHourSlots'

const date = '2026-10-19'
const claims: TimetableClaimRow[] = [
  { slot_date: date, slot: 'T0000', kind: 'buffer', booking_id: 'b1', booking_status: 'confirmed', event_reference: 'EVT-1', closure_reason: null },
  { slot_date: date, slot: 'T0015', kind: 'event', booking_id: 'b1', booking_status: 'confirmed', event_reference: 'EVT-1', closure_reason: null },
  { slot_date: date, slot: 'T1200', kind: 'maintenance', booking_id: null, booking_status: null, event_reference: null, closure_reason: 'Repairs' },
  { slot_date: date, slot: 'T2345', kind: 'event', booking_id: 'b2', booking_status: 'held', event_reference: 'EVT-2', closure_reason: null },
]

test('AC-047.2.32: single-venue timetable groups consecutive occupancy without hiding status, buffers, gaps or selection', () => {
  const timetable = buildTimetable([...QUARTER_HOUR_SLOTS].reverse(), claims, date, 2)
  const { rerender } = render(<VenueTimetableGrid timetable={timetable} selectedKeys={new Set([`${date}|T0000`])} />)
  expect(screen.getAllByRole('row')).toHaveLength(4)
  expect(screen.getAllByRole('cell')).toHaveLength(6)
  expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('Morning00:00–12:00')
  expect(screen.getAllByRole('rowheader')[2]).toHaveTextContent('Evening18:00–24:00')
  const cell = (slot: string) => screen.getByTestId(`cell-${date}|${slot}`)
  expect(cell('T0000')).toHaveTextContent('Confirmed booking (setup/turnaround)')
  expect(cell('T0000')).toHaveClass('ring-2')
  expect(cell('T0015')).toHaveTextContent('Confirmed booking')
  expect(cell('T0015')).not.toHaveClass('ring-2')
  expect(cell('T1200')).toHaveTextContent('Blocked')
  expect(cell('T2345')).toHaveTextContent('Tentatively held')
  expect(screen.getByTestId('cell-2026-10-20|T0000')).toHaveTextContent('Available')
  expect(screen.queryByRole('rowheader', { name: 'AM' })).not.toBeInTheDocument()
  const groupedClaims = [
    ...['T1100', 'T1115', 'T1130', 'T1145', 'T1200'].map(slot => ({ ...claims[1], slot, slot_date: date })),
    { ...claims[1], slot: 'T1230', booking_id: 'different-booking' },
  ] as TimetableClaimRow[]
  rerender(<VenueTimetableGrid timetable={buildTimetable(QUARTER_HOUR_SLOTS, groupedClaims, date, 1)} selectedKeys={new Set([`${date}|T1115`])} />)
  expect(cell('T1100')).toHaveTextContent('11:00–11:15')
  expect(cell('T1115')).toHaveClass('ring-2')
  expect(cell('T1130')).toHaveTextContent('11:30–12:00')
  expect(screen.queryByTestId(`cell-${date}|T1145`)).not.toBeInTheDocument()
  expect(cell('T1200')).toHaveTextContent('12:00–12:15')
  expect(cell('T1215')).toHaveTextContent('Available')
  expect(cell('T1230')).toHaveTextContent('Confirmed booking')
  rerender(<VenueTimetableGrid timetable={{ fromDate: date, days: [] }} />)
  expect(screen.queryAllByRole('cell')).toHaveLength(0)
})

test('AC-047.2.33: all-venue timetable preserves quarter-hour states, buffer labels and venue separation', () => {
  const availability = buildVenueAvailability([
    { id: 'v1', name: 'Hall', location: '', status: 'active' },
    { id: 'v2', name: 'Room', location: '', status: 'active' },
  ], QUARTER_HOUR_SLOTS, claims.map((claim) => ({ ...claim, venue_id: 'v1' })), date, 1)
  render(<MemoryRouter><VenueAvailabilityGrid availability={availability} linkVenues /></MemoryRouter>)
  for (const id of ['v1', 'v2']) {
    expect(within(screen.getByTestId(`venue-${id}`)).getAllByRole('row')).toHaveLength(96)
  }
  expect(screen.getByTestId(`cell-v1|${date}|T0000`)).toHaveTextContent('setup/turnaround')
  expect(screen.getByTestId(`cell-v1|${date}|T1200`)).toHaveTextContent('Repairs')
  expect(screen.getByTestId(`cell-v1|${date}|T2345`)).toHaveTextContent('Held')
  expect(screen.getByTestId(`cell-v2|${date}|T2345`)).toHaveTextContent('Free')
  expect(screen.getByRole('link', { name: 'Hall' })).toHaveAttribute('href', '/venues/v1/timetable')
})
