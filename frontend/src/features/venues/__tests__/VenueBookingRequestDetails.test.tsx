import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { VenueBookingRequestDetails } from '../components/VenueBookingRequestDetails'
import type { VenueBookingRequestDetails as Details } from '../venueBookingReviewTypes'
const details: Details = {
  eventName: 'Conference', reference: 'EVT-10', startsAt: '2032-10-12T05:00:00Z', endsAt: '2032-10-12T08:00:00Z',
  attendance: 120, layoutPreference: 'theatre',
  // The organiser's own requirements are code lists since 0054/0056.
  accessibilityRequirements: ['lift_access'], facilityRequirements: ['stage'],
  specialArrangements: 'Quiet space',
  requirementsRecorded: true, layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'],
}
test('AC-010.2.12: displays stored timing in Singapore and both sets of venue requirements', () => {
  render(<VenueBookingRequestDetails details={details} />)
  for (const value of ['Conference','EVT-10','120','Lift access','Stage','Quiet space',
    'Wheelchair access','Projector']) {
    expect(screen.getByText(value)).toBeInTheDocument()
  }
  expect(screen.getByText(/12 Oct 2032, 13:00/)).toBeInTheDocument()
})
test('AC-010.2.13: absent optional fields are explicit without inventing requirements', () => {
  render(<VenueBookingRequestDetails details={{ ...details, eventName: null, reference: null, startsAt: null,
    endsAt: null, attendance: null, layoutPreference: null, accessibilityRequirements: [],
    facilityRequirements: [], specialArrangements: null,
    requirementsRecorded: false }} />)
  expect(screen.getByText('Structured venue requirements have not been recorded.')).toBeInTheDocument()
  expect(screen.queryByText('Required layout')).not.toBeInTheDocument()
})
test('AC-010.2.14: recorded empty lists are distinct from missing requirements', () => {
  render(<VenueBookingRequestDetails details={{ ...details, layout: null, accessibility: [], facilities: [] }} />)
  expect(screen.getAllByText('None specified')).toHaveLength(2)
})
