import type { VenueReplacementContext } from '../venueReplacementService'
export const replacementIds = {
  source: '20653000-0000-4000-8000-000000000001', target: '20651000-0000-4000-8000-000000000002',
  request: '20654000-0000-4000-8000-000000000001', replacement: '20655000-0000-4000-8000-000000000001',
}
const details = { purpose: 'Workshop', proposedStart: '2039-01-03T01:00:00Z', proposedEnd: '2039-01-03T03:00:00Z',
  expectedAttendance: 50, layoutPreference: 'theatre', accessibilityRequirements: ['wheelchair_access'],
  facilityRequirements: ['wifi'], specialArrangements: 'Early setup' }
export const replacementFixture: VenueReplacementContext = {
  sources: [{ id: replacementIds.source, eventName: 'Workshop', venueName: 'Retired Hall', version: 'source-v1', details }],
  venues: [{ id: replacementIds.target, name: 'Alternative Hall', capacity: 120, location: 'Campus' }],
  requests: [{ id: replacementIds.request, originalBookingId: replacementIds.source, eventName: 'Workshop',
    originalVenue: 'Retired Hall', targetVenue: 'Alternative Hall', targetVenueId: replacementIds.target,
    reason: 'Old hall retired', status: 'pending', proposedBy: 'Coordinator', proposedAt: '2026-10-18T01:00:00Z',
    decidedBy: null, decidedAt: null, decisionNote: null, replacementBookingId: null, version: 'review-v1',
    sourceChanged: false, details, targetCapacity: 120, targetLayout: 'Theatre',
    targetAccessibility: ['wheelchair_access'], targetFacilities: { wifi: true, projector: false } }],
}
