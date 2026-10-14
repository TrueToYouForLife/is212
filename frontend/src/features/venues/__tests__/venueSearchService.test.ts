import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}))

import { listMyAssignedEvents, searchVenues, VENUE_SEARCH_MESSAGES } from '../../../../is212-structured-requirements-v5/frontend/src/features/venues/venueSearchService'
import type { VenueSearchFilters } from '../types'

/**
 * The wiring, not the matching rules: searchTextMatch.test.ts owns those. What these
 * check is that the service really applies them, and really asks the database for the
 * columns the filters now depend on.
 */

interface VenueSeed {
  id: string
  name: string
  location: string
  capacity?: number
  layout?: string
  accessibility?: string[]
  facility?: Record<string, unknown>
}

function venueRows(seeds: VenueSeed[]) {
  return seeds.map((seed) => ({
    id: seed.id, name: seed.name, location: seed.location,
    capacity: seed.capacity ?? 100, layout: seed.layout ?? 'hall',
    accessibility: seed.accessibility ?? [], facility: seed.facility ?? {},
    status: 'active',
  }))
}

/** A query builder that records its calls and resolves to the given rows. */
function stubVenues(seeds: VenueSeed[]) {
  const calls: { method: string; args: unknown[] }[] = []
  const query: Record<string, unknown> = {}
  const chain = (method: string) => vi.fn((...args: unknown[]) => {
    calls.push({ method, args })
    return query
  })
  for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'or', 'ilike', 'contains']) {
    query[method] = chain(method)
  }
  query.order = vi.fn((...args: unknown[]) => {
    calls.push({ method: 'order', args })
    return Promise.resolve({ data: venueRows(seeds), error: null })
  })
  // No slot claims, so the availability filter never removes anything here.
  const claims: Record<string, unknown> = {}
  for (const method of ['select', 'in', 'gte', 'lte']) {
    claims[method] = vi.fn(() => claims)
  }
  Object.assign(claims, { then: undefined })
  mocks.from.mockImplementation((table: string) => (table === 'venues' ? query : claims))
  return { calls }
}

const emptyFilters: VenueSearchFilters = {
  keyword: '', location: '', minAttendance: '', layout: '',
  accessibility: [], facilities: [], date: '', slot: '', eventId: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'coordinator-1' } }, error: null })
})

describe('AC-008.5 — the free-text filters are applied, ignoring case and punctuation', () => {
  test('AC-008.5.1: a keyword with different case and a full stop still finds the venue', async () => {
    stubVenues([
      { id: 'v1', name: 'Main Hall', location: 'Level 2' },
      { id: 'v2', name: 'Annex', location: 'Level 3' },
    ])
    const result = await searchVenues({ ...emptyFilters, keyword: '  MAIN hall. ' }, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.venues.map((venue) => venue.id)).toEqual(['v1'])
  })

  test('AC-008.5.2: the keyword matches the location as well as the name', async () => {
    stubVenues([
      { id: 'v1', name: 'Main Hall', location: 'Level 2' },
      { id: 'v2', name: 'Annex', location: 'Basement' },
    ])
    const result = await searchVenues({ ...emptyFilters, keyword: 'basement' }, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.venues.map((venue) => venue.id)).toEqual(['v2'])
  })

  test('AC-008.5.3: a keyword of only punctuation does not hide every venue', async () => {
    stubVenues([{ id: 'v1', name: 'Main Hall', location: 'Level 2' }])
    const result = await searchVenues({ ...emptyFilters, keyword: ' . ' }, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.venues).toHaveLength(1)
  })

  test('AC-008.5.4: a layout code matches a venue that spells it differently', async () => {
    // venues.layout was repaired from older data by 0019a and holds "U-shape" here,
    // while the filter holds the catalogue code "u_shape".
    stubVenues([
      { id: 'v1', name: 'Main Hall', location: 'Level 2', layout: 'U-shape' },
      { id: 'v2', name: 'Annex', location: 'Level 3', layout: 'theatre' },
    ])
    const result = await searchVenues({ ...emptyFilters, layout: 'u_shape' }, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.venues.map((venue) => venue.id)).toEqual(['v1'])
  })

  test('AC-008.5.5: text filters are not sent to the database as ilike patterns', async () => {
    // They cannot be: the stored value keeps its punctuation, so a stripped search term
    // would never match it. Sending both would also double-filter and drop valid rows.
    const { calls } = stubVenues([{ id: 'v1', name: 'Main Hall', location: 'Level 2' }])
    await searchVenues({ ...emptyFilters, keyword: 'main', location: 'level' }, [])
    expect(calls.filter((call) => call.method === 'or')).toHaveLength(0)
    expect(calls.filter((call) => call.method === 'ilike')).toHaveLength(0)
  })

  test('AC-008.5.6: capacity and accessibility are still narrowed by the database', async () => {
    const { calls } = stubVenues([{ id: 'v1', name: 'Main Hall', location: 'Level 2' }])
    await searchVenues({
      ...emptyFilters, minAttendance: '150', accessibility: ['lift_access'],
    }, [])
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'gte', args: ['capacity', 150] },
      { method: 'contains', args: ['accessibility', ['lift_access']] },
    ]))
  })

  test('AC-008.5.7: a signed-out caller is refused before any query runs', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await searchVenues(emptyFilters, [])
    expect(result).toEqual({ ok: false, reason: VENUE_SEARCH_MESSAGES.notSignedIn })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('AC-008.6 — an assigned event carries its structured requirements', () => {
  test('AC-008.6.1: the requirement columns are read and mapped to code lists', async () => {
    const query: Record<string, unknown> = {}
    const selected: string[] = []
    query.select = vi.fn((columns: string) => { selected.push(columns); return query })
    query.eq = vi.fn(() => query)
    query.order = vi.fn(() => Promise.resolve({
      data: [{
        id: 'event-1', reference: 'EVT-1', name: 'Dinner',
        proposed_start: null, proposed_end: null, expected_attendance: 180,
        layout_preference: 'banquet',
        accessibility_requirements: ['wheelchair_access'],
        facility_requirements: ['projector'],
        equipment_requirements: ['wireless_mic'],
      }],
      error: null,
    }))
    mocks.from.mockReturnValue(query)

    const events = await listMyAssignedEvents()
    expect(selected.join(' ')).toContain('facility_requirements')
    expect(events).toEqual([{
      id: 'event-1', reference: 'EVT-1', name: 'Dinner',
      proposedStart: null, proposedEnd: null, expectedAttendance: 180,
      layoutPreference: 'banquet',
      accessibilityRequirements: ['wheelchair_access'],
      facilityRequirements: ['projector'],
      equipmentRequirements: ['wireless_mic'],
    }])
  })

  test('AC-008.6.2: a row written before the columns had defaults reads as empty lists', async () => {
    const query: Record<string, unknown> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.order = vi.fn(() => Promise.resolve({
      data: [{
        id: 'event-1', reference: null, name: null,
        proposed_start: null, proposed_end: null, expected_attendance: null,
        layout_preference: null, accessibility_requirements: null,
        facility_requirements: null, equipment_requirements: null,
      }],
      error: null,
    }))
    mocks.from.mockReturnValue(query)

    const [event] = await listMyAssignedEvents()
    expect(event.accessibilityRequirements).toEqual([])
    expect(event.facilityRequirements).toEqual([])
    expect(event.equipmentRequirements).toEqual([])
  })
})
