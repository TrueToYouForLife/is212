import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { AvailabilityLegend, VenueAvailabilityGrid } from '../components/VenueAvailabilityGrid'
import { buildVenueAvailability } from '../venueAvailability'
import type { AvailabilityClaimRow, AvailabilityVenue } from '../venueAvailability'
import { SLOTS } from './fixtures/venueBooking'

const HALL: AvailabilityVenue = { id: 'v-hall', name: 'Alpha Hall', location: 'Level 1', status: 'active' }
const ROOM: AvailabilityVenue = { id: 'v-room', name: 'Breakout Room', location: '', status: 'under_maintenance' }

function claim(overrides: Partial<AvailabilityClaimRow>): AvailabilityClaimRow {
  return {
    venue_id: HALL.id, slot_date: '2026-10-12', slot: 'AM', kind: 'event',
    booking_id: 'b-1', booking_status: 'confirmed', event_reference: 'EVT-1', closure_reason: null,
    ...overrides,
  }
}

function renderGrid(claims: AvailabilityClaimRow[] = [], { linkVenues = false, slots = SLOTS } = {}) {
  const availability = buildVenueAvailability([HALL, ROOM], slots, claims, '2026-10-12', 7)
  render(
    <MemoryRouter>
      <VenueAvailabilityGrid availability={availability} linkVenues={linkVenues} />
    </MemoryRouter>,
  )
}

const cell = (venueId: string, date: string, slot: string) => screen.getByTestId(`cell-${venueId}|${date}|${slot}`)

describe('AC-019.1 — staff can view availability across dates', () => {
  test('AC-019.1.12: for coordinators, each venue name opens that venue\'s own timetable', () => {
    renderGrid([], { linkVenues: true })
    expect(screen.getByRole('link', { name: 'Alpha Hall' })).toHaveAttribute('href', '/venues/v-hall/timetable')
  })

  test('AC-019.1.13: for Venue Staff, venue names are plain text, and the venue\'s location and maintenance are shown', () => {
    renderGrid()
    expect(screen.queryByRole('link')).toBeNull()
    const hall = within(screen.getByTestId('venue-v-hall'))
    expect(hall.getByText('Level 1')).toBeInTheDocument()
    expect(hall.queryByText('Under maintenance')).toBeNull()
    expect(within(screen.getByTestId('venue-v-room')).getByText('Under maintenance')).toBeInTheDocument()
  })
})

describe('AC-019.2 — bookings and confirmed events are blocked out', () => {
  test('AC-019.2.9: each kind of occupancy has its own wording, on screen and for screen readers', () => {
    renderGrid([
      claim({ slot: 'AM', booking_status: 'confirmed' }),
      claim({ slot: 'PM', booking_id: 'b-2', booking_status: 'held', event_reference: 'EVT-2' }),
      claim({ slot: 'NIGHT', booking_id: 'b-3', booking_status: 'pending_approval', event_reference: 'EVT-3' }),
    ])

    expect(cell(HALL.id, '2026-10-12', 'AM')).toHaveTextContent('Booked')
    expect(cell(HALL.id, '2026-10-12', 'AM')).toHaveAttribute(
      'aria-label', 'Alpha Hall, 12 Oct 2026 AM: Confirmed booking, EVT-1',
    )
    expect(cell(HALL.id, '2026-10-12', 'PM')).toHaveTextContent('Held')
    expect(cell(HALL.id, '2026-10-12', 'NIGHT')).toHaveTextContent('Requested')
    expect(cell(HALL.id, '2026-10-13', 'AM')).toHaveTextContent('Free')
    expect(cell(HALL.id, '2026-10-13', 'AM')).toHaveAttribute('aria-label', 'Alpha Hall, 13 Oct 2026 AM: Available')
  })

  test('AC-019.2.10: a Venue Staff block shows as blocked, with its reason', () => {
    renderGrid([claim({ kind: 'maintenance', booking_id: null, booking_status: null, event_reference: null, closure_reason: 'Aircon repair' })])
    const blocked = cell(HALL.id, '2026-10-12', 'AM')
    expect(blocked).toHaveTextContent('Blocked')
    expect(blocked).toHaveTextContent('Aircon repair')
    expect(blocked).toHaveAttribute('aria-label', 'Alpha Hall, 12 Oct 2026 AM: Blocked, Aircon repair')
  })

  test('AC-019.2.11: the key names every state, including setup and turnaround', () => {
    render(<AvailabilityLegend />)
    const key = within(screen.getByRole('list', { name: 'Key' }))
    for (const label of ['Free', 'Tentatively held', 'Awaiting Venue Staff', 'Confirmed booking', 'Blocked by Venue Staff']) {
      expect(key.getByText(label)).toBeInTheDocument()
    }
    expect(key.getByText(/setup or turnaround/)).toBeInTheDocument()
  })
})

describe('AC-019.3 — each day is shown as AM, PM and Night', () => {
  test('AC-019.3.1: every venue has AM, PM and Night rows in that order, even when slots are defined out of order', () => {
    renderGrid([], { slots: [SLOTS[2], SLOTS[0], SLOTS[1]] })
    for (const venueId of [HALL.id, ROOM.id]) {
      const rows = within(screen.getByTestId(`venue-${venueId}`)).getAllByRole('row')
      expect(rows.map((row) => within(row).getAllByRole('rowheader').at(-1)?.textContent)).toEqual(['AM', 'PM', 'Night'])
    }
  })

  test('AC-019.3.2: a full-day booking fills all three slots, with setup and turnaround either side', () => {
    renderGrid([
      claim({ slot_date: '2026-10-13', slot: 'AM' }),
      claim({ slot_date: '2026-10-13', slot: 'PM' }),
      claim({ slot_date: '2026-10-13', slot: 'NIGHT' }),
      claim({ slot_date: '2026-10-12', slot: 'NIGHT', kind: 'buffer' }),
      claim({ slot_date: '2026-10-14', slot: 'AM', kind: 'buffer' }),
    ])

    for (const slot of ['AM', 'PM', 'NIGHT']) {
      expect(cell(HALL.id, '2026-10-13', slot)).toHaveTextContent('Booked')
    }
    const setup = cell(HALL.id, '2026-10-12', 'NIGHT')
    expect(setup).toHaveTextContent('setup/turnaround')
    expect(setup).toHaveAttribute('aria-label', 'Alpha Hall, 12 Oct 2026 Night: Confirmed booking (setup/turnaround), EVT-1')
    expect(setup.getAttribute('style')).toContain('repeating-linear-gradient')
    expect(cell(HALL.id, '2026-10-14', 'AM')).toHaveTextContent('setup/turnaround')
    expect(cell(HALL.id, '2026-10-13', 'AM').getAttribute('style')).toBeNull()
  })

  test('AC-019.3.3: one column per day of the week, headed with weekday and date', () => {
    renderGrid()
    const headings = screen.getAllByRole('columnheader').slice(2).map((heading) => heading.textContent)
    expect(headings).toEqual(['Mon12 Oct', 'Tue13 Oct', 'Wed14 Oct', 'Thu15 Oct', 'Fri16 Oct', 'Sat17 Oct', 'Sun18 Oct'])
  })

  test('AC-019.3.4: each venue shows 21 cells for the week, three a day', () => {
    renderGrid()
    expect(within(screen.getByTestId('venue-v-hall')).getAllByRole('cell')).toHaveLength(21)
  })
})
