import { BLOCK_SLOTS } from '../venueBlockValidation'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { VenueBlockList } from '../components/VenueBlockList'
import type { VenueBlock } from '../venueBlockTypes'

const FULL_DAYS: VenueBlock = {
  id: 'block-1',
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-12',
  slots: [...BLOCK_SLOTS],
  reason: 'Ceiling repair',
  createdByName: 'Vera Venue',
  createdAt: '2039-12-05T02:00:00+00:00',
}

const ONE_DAY: VenueBlock = {
  ...FULL_DAYS,
  id: 'block-2',
  startsOn: '2040-03-15',
  endsOn: '2040-03-15',
  slots: ['T0900', 'T2345'],
  reason: 'Electrical safety check',
}

describe('AC-012.9 — current blocks can be viewed', () => {
  test('AC-012.9.18: each block shows its dates and slots, with all 96 slots as Full day', () => {
    render(<VenueBlockList blocks={[FULL_DAYS, ONE_DAY]} />)

    expect(screen.getByText('10 Mar 2040 – 12 Mar 2040')).toBeInTheDocument()
    expect(screen.getByText('Full day')).toBeInTheDocument()
    expect(screen.getByText('15 Mar 2040')).toBeInTheDocument()
    expect(screen.getByText('09:00–09:15, 23:45–24:00')).toBeInTheDocument()
  })

  test('AC-012.9.22: a venue with no current blocks says so', () => {
    render(<VenueBlockList blocks={[]} />)
    expect(screen.getByText('No current blocks on this venue.')).toBeInTheDocument()
  })
})

describe('AC-012.10 — who blocked, and when', () => {
  test('AC-012.10.6: each block shows its reason, who created it and when', () => {
    render(<VenueBlockList blocks={[FULL_DAYS]} />)

    expect(screen.getByText('Ceiling repair')).toBeInTheDocument()
    expect(screen.getByText(/Blocked by Vera Venue/)).toHaveTextContent(/2039/)
  })
})

test('AC-047.2.36: saved blocks combine adjacent quarters but preserve legacy gaps instead of claiming full day', () => {
  const legacyCoverage = BLOCK_SLOTS.filter((code) =>
    (code >= 'T0700' && code < 'T1200') || (code >= 'T1300' && code < 'T1800') || code >= 'T1900')
  render(<VenueBlockList blocks={[{ ...FULL_DAYS, slots: [...legacyCoverage] }]} />)
  expect(screen.getByText('07:00–12:00, 13:00–18:00, 19:00–24:00')).toBeInTheDocument()
  expect(screen.queryByText('Full day')).not.toBeInTheDocument()
})

test('AC-012.9.29: continuous endpoints show both Singapore dates/times while legacy blocks retain daily ranges', () => {
  render(<VenueBlockList blocks={[{ ...FULL_DAYS, startsAt: '2049-10-21T13:00:00Z', endsAt: '2049-10-22T00:00:00Z' }, ONE_DAY]} />)
  expect(screen.getByText('Continuous block')).toBeInTheDocument()
  expect(screen.getByText(/Singapore time/)).toHaveTextContent(/21.*Oct.*2049.*21:00.*22.*Oct.*2049.*08:00/)
  expect(screen.getByText('09:00–09:15, 23:45–24:00')).toBeInTheDocument()
  expect(screen.getByText('on each date')).toBeInTheDocument()
})
