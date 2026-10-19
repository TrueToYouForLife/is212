import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { ReadinessSummary } from '../ReadinessSummary'
import type { ReadinessLine } from '../types'

const line = (arrangement: string, label: string, complete: boolean, detail: string, sortOrder: number): ReadinessLine =>
  ({ arrangement, label, complete, detail, sortOrder })

const LINES = [
  line('venue_booking', 'Venue booking', true, '1 venue booking approved.', 1),
  line('equipment_reservation', 'Equipment reservation', false, '1 of 2 essential items reserved.', 2),
  line('programme', 'Programme', false, 'No programme yet.', 4),
]

function renderSummary(lines: ReadinessLine[]) {
  return render(<MemoryRouter><ReadinessSummary eventId="e-1" lines={lines} /></MemoryRouter>)
}

const items = () => within(screen.getByRole('list', { name: 'Arrangements' })).getAllByRole('listitem')

describe('AC-005.1 — the Coordinator sees the status of each required arrangement', () => {
  test('AC-005.1.4: every arrangement is listed with its status and detail, and the summary counts what is complete', () => {
    renderSummary(LINES)
    expect(screen.getByText('1 of 3 arrangements complete.')).toBeInTheDocument()
    expect(items().map((item) => item.querySelector('p')?.textContent)).toEqual(['Venue booking', 'Equipment reservation', 'Programme'])
    expect(screen.getByText('1 of 2 essential items reserved.')).toBeInTheDocument()
  })
})

describe('AC-005.3 — complete and outstanding are clearly distinct', () => {
  test('AC-005.3.1: complete and outstanding each have their own word and symbol, not just a colour', () => {
    renderSummary(LINES)
    const [venue, equipment] = items()
    expect(venue).toHaveAttribute('data-complete', 'true')
    expect(within(venue).getByText('Complete')).toBeInTheDocument()
    expect(within(venue).getByText('✓')).toHaveAttribute('aria-hidden', 'true')
    expect(equipment).toHaveAttribute('data-complete', 'false')
    expect(within(equipment).getByText('Outstanding')).toBeInTheDocument()
    expect(within(equipment).getByText('!')).toHaveAttribute('aria-hidden', 'true')
  })

  test('AC-005.3.2: with everything complete, the summary says so', () => {
    renderSummary([LINES[0]])
    expect(screen.getByText('Every arrangement is complete.')).toBeInTheDocument()
  })
})

describe('AC-005.5 — an outstanding arrangement leads to where it is dealt with', () => {
  test('AC-005.5.3: outstanding lines link onwards, to another page or to a section of this one; complete lines do not', () => {
    renderSummary(LINES)
    const [venue, equipment, programme] = items()
    expect(within(venue).queryByRole('link')).toBeNull()
    expect(within(equipment).getByRole('link', { name: 'Open equipment requirements' })).toHaveAttribute('href', '/requests/e-1/equipment')
    expect(within(programme).getByRole('link', { name: 'Add the programme' })).toHaveAttribute('href', '#planning-details')
  })
})

describe('AC-005.6 — the summary shows whatever arrangements the event has', () => {
  test('AC-005.6.2: an arrangement added by a later story (a test double for the safety review) is shown like any other, with no link yet', () => {
    renderSummary([...LINES, line('safety_review', 'Safety review', false, 'Awaiting the Safety Officer.', 6)])
    const safety = items()[3]
    expect(within(safety).getByText('Safety review')).toBeInTheDocument()
    expect(within(safety).getByText('Outstanding')).toBeInTheDocument()
    expect(within(safety).getByText('Awaiting the Safety Officer.')).toBeInTheDocument()
    expect(within(safety).queryByRole('link')).toBeNull()
    expect(screen.getByText('1 of 4 arrangements complete.')).toBeInTheDocument()
  })
})

describe('AC-005.8 — arrangements that do not apply are left out', () => {
  test('AC-005.8.2: with no arrangements to show, nothing is presented as outstanding', () => {
    renderSummary([])
    expect(screen.getByText('No arrangements are needed for this event yet.')).toBeInTheDocument()
    expect(screen.queryByText('Outstanding')).toBeNull()
  })
})
