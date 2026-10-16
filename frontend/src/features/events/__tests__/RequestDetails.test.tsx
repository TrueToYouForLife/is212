import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { RequestDetails } from '../components/RequestDetails'
import type { EventRequestDetail } from '../types'

const fullRequest: EventRequestDetail = {
  id: 'c0ffee00-0000-4000-8000-000000000001',
  reference: 'EVT-2026-0042',
  organiserId: 'organiser-1',
  name: 'Client Appreciation Dinner',
  purpose: 'Thank our largest clients',
  eventType: 'Gala dinner',
  description: 'Evening reception followed by dinner.',
  proposedStart: '2099-06-01T10:00:00Z',
  proposedEnd: '2099-06-01T14:00:00Z',
  expectedAttendance: 120,
  programme: '18:00 reception, 19:00 dinner',
  layoutPreference: 'Banquet',
  accessibilityRequirements: 'Step-free access',
  equipmentRequirements: 'Two radio microphones',
  registrationRequired: true,
  specialArrangements: 'Halal menu options',
  status: 'submitted',
  submittedAt: '2026-01-05T02:11:00Z',
  reviewNote: null,
  reviewedAt: null,
  createdAt: '2026-01-04T02:11:00Z',
}

const valueFor = (label: string) => screen.getByText(label).nextElementSibling

describe('AC-004.1 — coordinator views the full details of a submitted request', () => {
  test('AC-004.1.4: shows every detail the organiser supplied', () => {
    render(<RequestDetails request={fullRequest} />)

    expect(valueFor('Event name')).toHaveTextContent('Client Appreciation Dinner')
    expect(valueFor('Purpose')).toHaveTextContent('Thank our largest clients')
    expect(valueFor('Type of event')).toHaveTextContent('Gala dinner')
    expect(valueFor('Description')).toHaveTextContent('Evening reception followed by dinner.')
    expect(valueFor('Expected attendance')).toHaveTextContent('120')
    expect(valueFor('Programme')).toHaveTextContent('18:00 reception, 19:00 dinner')
    expect(valueFor('Room layout')).toHaveTextContent('Banquet')
    expect(valueFor('Accessibility')).toHaveTextContent('Step-free access')
    expect(valueFor('Equipment')).toHaveTextContent('Two radio microphones')
    expect(valueFor('Registration required')).toHaveTextContent('Yes')
    expect(valueFor('Special arrangements')).toHaveTextContent('Halal menu options')
    // Dates are formatted for reading, so only check that a real date replaced the dash.
    for (const label of ['Preferred start', 'Preferred end', 'Submitted']) {
      expect(valueFor(label)).not.toHaveTextContent('—')
    }
  })

  test('AC-004.1.5: optional details the organiser left blank read as a dash, not an empty cell', () => {
    render(
      <RequestDetails
        request={{
          ...fullRequest,
          name: null, eventType: null, description: null, programme: null,
          layoutPreference: null, accessibilityRequirements: null,
          equipmentRequirements: null, specialArrangements: null, registrationRequired: false,
        }}
      />,
    )

    for (const label of ['Event name', 'Type of event', 'Description', 'Programme',
      'Room layout', 'Accessibility', 'Equipment', 'Special arrangements']) {
      expect(valueFor(label)).toHaveTextContent('—')
    }
    expect(valueFor('Registration required')).toHaveTextContent('No')
  })

  test('AC-004.1.6: an earlier review note is shown only when one exists', () => {
    const { rerender } = render(<RequestDetails request={fullRequest} />)
    expect(screen.queryByText('Review note')).not.toBeInTheDocument()

    rerender(<RequestDetails request={{ ...fullRequest, reviewNote: 'Please add a programme.' }} />)
    expect(valueFor('Review note')).toHaveTextContent('Please add a programme.')
  })
})
