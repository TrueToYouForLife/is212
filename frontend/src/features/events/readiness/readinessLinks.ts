/**
 * PURE MODULE — US5 AC-005.5: where an outstanding arrangement is dealt with.
 *
 * `route` goes to another page; `anchor` jumps to a section of the event's own page, where the
 * summary is shown. An arrangement this module does not know yet (one a later story adds) has
 * no link rather than a wrong one.
 */
export type ReadinessLink =
  | { kind: 'route'; to: string; text: string }
  | { kind: 'anchor'; to: string; text: string }

export function readinessLink(arrangement: string, eventId: string): ReadinessLink | null {
  switch (arrangement) {
    case 'venue_booking':
      return { kind: 'route', to: '/venues/search', text: 'Find and book a venue' }
    case 'equipment_reservation':
    case 'technical_support':
      return { kind: 'route', to: `/requests/${eventId}/equipment`, text: 'Open equipment requirements' }
    case 'programme':
      return { kind: 'anchor', to: '#planning-details', text: 'Add the programme' }
    case 'registration_setup':
      return { kind: 'anchor', to: '#event-decision', text: 'Registration opens when the event is confirmed' }
    default:
      return null
  }
}
