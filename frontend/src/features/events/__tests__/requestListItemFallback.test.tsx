import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { RequestListItem } from '../components/RequestListItem'
import type { EventRequestSummary } from '../types'

const request: EventRequestSummary = {
  id: 'e-1', reference: 'EVT-1', organiserId: 'o-1', coordinatorId: null, name: null,
  purpose: 'Quarterly town hall', eventType: 'Meeting', proposedStart: '2035-03-10T01:00:00Z',
  proposedEnd: '2035-03-10T09:00:00Z', expectedAttendance: 40, status: 'submitted',
  submittedAt: '2035-01-01T01:00:00Z', reviewNote: null,
}

describe('AC-004.1 — every request in the list can be told apart', () => {
  test('AC-004.1.9: a request with no name is listed by its purpose, and with neither by a dash', () => {
    const { rerender } = render(<MemoryRouter><ul><RequestListItem request={request} /></ul></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Quarterly town hall' })).toBeInTheDocument()
    rerender(<MemoryRouter><ul><RequestListItem request={{ ...request, purpose: null }} /></ul></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '—' })).toBeInTheDocument()
  })
})
