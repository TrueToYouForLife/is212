import { describe, expect, test } from 'vitest'
import { readinessLink } from '../readinessLinks'

describe('AC-005.5 — an outstanding arrangement leads to where it is dealt with', () => {
  test('AC-005.5.1: each arrangement links to the page or section that governs it', () => {
    expect(readinessLink('venue_booking', 'e-1')).toEqual({ kind: 'route', to: '/venues/search', text: 'Find and book a venue' })
    expect(readinessLink('equipment_reservation', 'e-1')).toEqual({ kind: 'route', to: '/requests/e-1/equipment', text: 'Open equipment requirements' })
    expect(readinessLink('technical_support', 'e-1')).toEqual({ kind: 'route', to: '/requests/e-1/equipment', text: 'Open equipment requirements' })
    expect(readinessLink('programme', 'e-1')).toEqual({ kind: 'anchor', to: '#planning-details', text: 'Add the programme' })
    expect(readinessLink('registration_setup', 'e-1')).toEqual({ kind: 'anchor', to: '#event-decision', text: 'Registration opens when the event is confirmed' })
  })

  test('AC-005.5.2: an arrangement a later story adds has no link until that story gives it one, never a wrong one', () => {
    expect(readinessLink('safety_review', 'e-1')).toBeNull()
  })
})
