import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { VenueResultCard } from '../components/VenueResultCard'
import type { VenueAssessment } from '../suitabilityTypes'
import type { Venue } from '../types'

const VENUE: Venue = {
  id: 'v1', name: 'Main Hall', capacity: 200, layout: 'theatre',
  accessibility: [], facility: {}, status: 'active', location: 'Level 2',
}

test('AC-009.1.27: missing location is explicit and both counted and boolean facilities are displayed', () => {
  render(<MemoryRouter><ul><VenueResultCard venue={{ ...VENUE, location: '', facility: { projector: true, microphone: 3, unavailable: false } }} /></ul></MemoryRouter>)
  expect(screen.getByText('projector, microphone (3)')).toBeInTheDocument()
  expect(screen.queryByText('unavailable')).not.toBeInTheDocument()
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
})

function assessment(overrides: Partial<VenueAssessment>): VenueAssessment {
  return {
    venue: { id: 'v1', name: 'Main Hall', location: 'Level 2', status: 'active', layouts: [], accessibility: [], facility: {} },
    verdict: 'suitable',
    reasons: [],
    fittingLayouts: [],
    ...overrides,
  }
}

describe('AC-018.1 — coordinators can identify suitable venues', () => {
  test('AC-018.1.32: when searching for an event, each result shows its verdict for that event', () => {
    render(<MemoryRouter><ul><VenueResultCard venue={VENUE} assessment={assessment({})} /></ul></MemoryRouter>)
    expect(screen.getByText('Suitable for this event')).toBeInTheDocument()
  })

  test('AC-018.1.33: a search not tied to an event shows no verdict', () => {
    render(<MemoryRouter><ul><VenueResultCard venue={VENUE} /></ul></MemoryRouter>)
    expect(screen.queryByText(/for this event/)).not.toBeInTheDocument()
  })
})

describe('AC-018.3 — venues that do not meet requirements are marked unsuitable', () => {
  test('AC-018.3.34: an unsuitable result shows its first reason and how many more there are', () => {
    render(<MemoryRouter><ul><VenueResultCard venue={VENUE} assessment={assessment({
      verdict: 'unsuitable',
      reasons: [
        { code: 'capacity', message: 'Holds at most 20 in any layout; 60 attendees are expected.' },
        { code: 'facility', message: 'Missing facilities: Projector.' },
      ],
    })} /></ul></MemoryRouter>)
    expect(screen.getByText('Unsuitable for this event')).toBeInTheDocument()
    expect(screen.getByText('Holds at most 20 in any layout; 60 attendees are expected. (+1 more)')).toBeInTheDocument()
  })
})
