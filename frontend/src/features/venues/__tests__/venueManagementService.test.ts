import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  VENUE_MANAGEMENT_MESSAGES as messages, addVenue, listManagedVenues, loadLayoutOptions, loadVenueForEdit, updateVenue,
} from '../venueManagementService'
import type { NewVenue } from '../venueManagementValidation'
import { createSupabaseFake } from './fixtures/venueBooking'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc },
}))

const fake = createSupabaseFake()

const VENUE: NewVenue = {
  name: 'Grand Hall',
  location: 'Level 1',
  opensAt: '07:00',
  closesAt: '24:00',
  accessibility: ['wheelchair_access'],
  facilities: ['projector', 'wifi'],
  layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 60 }],
}

beforeEach(() => {
  vi.resetAllMocks()
  fake.reset()
  mocks.from.mockImplementation(fake.route)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'staff-1' } }, error: null })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

describe('AC-046.1 — Venue Staff can add a venue with its details', () => {
  test('AC-046.1.13: the venue and all its layouts are sent in one call, so they are saved together', async () => {
    mocks.rpc.mockResolvedValue({ data: 'venue-1', error: null })
    expect(await addVenue(VENUE)).toEqual({ ok: true, venueId: 'venue-1' })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('add_venue', {
      p_name: 'Grand Hall',
      p_location: 'Level 1',
      p_opens_at: '07:00',
      p_closes_at: '24:00',
      p_accessibility: ['wheelchair_access'],
      p_facilities: ['projector', 'wifi'],
      p_layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 60 }],
    })
  })

  test('AC-046.1.14: a signed-out user sends nothing', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-046.1.15: a name already in use and hours off slot boundaries are explained', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: messages.duplicateName })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check violation' } })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: messages.invalidHours })
  })

  test('AC-046.1.16: the database\'s own reasons for refusing a venue are shown as they are', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Every layout needs a capacity of at least 1' } })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: 'Every layout needs a capacity of at least 1' })
  })

  test('AC-046.1.17: an unexpected failure gives a general message and is logged', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection lost' } })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: messages.failed })
    expect(console.error).toHaveBeenCalled()
  })

  test('AC-046.1.18: layout options come from the layout catalogue, in its order', async () => {
    fake.plan('layout_types', { data: [{ code: 'theatre', label: 'Theatre' }, { code: 'classroom', label: 'Classroom' }] })
    expect(await loadLayoutOptions()).toEqual({
      ok: true,
      layouts: [{ code: 'theatre', label: 'Theatre' }, { code: 'classroom', label: 'Classroom' }],
    })
    expect(fake.callsTo('layout_types', 'order')).toEqual([['sort_order']])
  })

  test('AC-046.1.19: a failed or empty layout catalogue is reported, never shown as a form nobody can complete', async () => {
    fake.plan('layout_types', { error: { message: 'down' } })
    expect(await loadLayoutOptions()).toEqual({ ok: false, reason: messages.layoutsUnavailable })
    expect(console.error).toHaveBeenCalled()
    fake.reset()
    fake.plan('layout_types', { data: null })
    expect(await loadLayoutOptions()).toEqual({ ok: false, reason: messages.layoutsUnavailable })
  })
})

describe('AC-046.6 — only Venue Staff can add venues', () => {
  test('AC-046.6.8: when the database refuses because the user is not Venue Staff, they are told so', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only Venue Staff can add venues' } })
    expect(await addVenue(VENUE)).toEqual({ ok: false, reason: messages.notVenueStaff })
  })
})

const LOADED = {
  id: 'venue-1', name: 'Grand Hall', location: 'Level 1', status: 'active', opensAt: '07:00', closesAt: '24:00',
  accessibility: ['wheelchair_access'], facilities: ['projector'], layouts: [{ layout: 'theatre', capacity: 120 }],
  version: 'v1',
}

describe('AC-046.2 — Venue Staff can edit any of a venue’s details', () => {
  test('AC-046.2.12: the venues to manage are listed by name, retired ones included', async () => {
    fake.plan('venues', { data: [
      { id: 'v1', name: 'Alpha', location: null, status: 'retired', capacity: 10 },
      { id: 'v2', name: 'Beta', location: 'Level 2', status: 'active', capacity: 50 },
    ] })
    expect(await listManagedVenues()).toEqual({ ok: true, venues: [
      { id: 'v1', name: 'Alpha', location: '', status: 'retired', capacity: 10 },
      { id: 'v2', name: 'Beta', location: 'Level 2', status: 'active', capacity: 50 },
    ] })
    expect(fake.callsTo('venues', 'order')).toEqual([['name']])
    expect(fake.callsTo('venues', 'neq')).toEqual([])
  })

  test('AC-046.2.13: a failed venue list is reported and logged; an empty one is just empty', async () => {
    fake.plan('venues', { error: { message: 'down' } })
    expect(await listManagedVenues()).toEqual({ ok: false, reason: messages.venuesUnavailable })
    expect(console.error).toHaveBeenCalled()
    fake.reset()
    fake.plan('venues', { data: null })
    expect(await listManagedVenues()).toEqual({ ok: true, venues: [] })
  })

  test('AC-046.2.14: a venue opens for editing with the version saving will check', async () => {
    mocks.rpc.mockResolvedValue({ data: LOADED, error: null })
    expect(await loadVenueForEdit('venue-1')).toEqual({ ok: true, venue: LOADED })
    expect(mocks.rpc).toHaveBeenCalledWith('get_venue_for_edit', { p_venue_id: 'venue-1' })
  })

  test('AC-046.2.15: a missing venue, a failed load or an unexpected answer is reported, never shown as a blank form', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'Venue not found' } })
    expect(await loadVenueForEdit('venue-1')).toEqual({ ok: false, reason: messages.venueNotFound })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await loadVenueForEdit('venue-1')).toEqual({ ok: false, reason: messages.venueUnavailable })
    mocks.rpc.mockResolvedValueOnce({ data: { id: 'venue-1' }, error: null })
    expect(await loadVenueForEdit('venue-1')).toEqual({ ok: false, reason: messages.venueUnavailable })
    expect(console.error).toHaveBeenCalledTimes(2)
  })

  test('AC-046.2.16: every detail is saved in one call, with the version the form was opened at', async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: true, flagged: 0 })
    expect(mocks.rpc).toHaveBeenCalledWith('update_venue', {
      p_venue_id: 'venue-1',
      p_version: 'v1',
      p_name: 'Grand Hall',
      p_location: 'Level 1',
      p_opens_at: '07:00',
      p_closes_at: '24:00',
      p_accessibility: ['wheelchair_access'],
      p_facilities: ['projector', 'wifi'],
      p_layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 60 }],
    })
  })

  test('AC-046.2.17: an edit someone else got to first is reported as out of date, so it can be reloaded', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'changed' } })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason: messages.stale, stale: true })
  })

  test.each([
    ['P0002', messages.venueNotFound],
    ['23505', messages.duplicateName],
    ['23514', messages.invalidHours],
  ])('AC-046.2.18: a %s refusal is explained', async (code, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'refused' } })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason })
  })

  test('AC-046.2.19: the database’s own reasons are shown as they are; anything unexpected is general and logged; signed out sends nothing', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'A venue needs at least one layout' } })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason: 'A venue needs at least one layout' })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '08006', message: 'down' } })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason: messages.failed })
    expect(console.error).toHaveBeenCalled()
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mocks.rpc.mockClear()
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason: messages.notSignedIn })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe('AC-046.4 — bookings an edit may have made unsuitable are flagged', () => {
  test('AC-046.4.14: saving reports how many bookings were flagged for review', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: true, flagged: 3 })
  })

  test('AC-046.4.15: an answer without a count is read as nothing flagged, never as a failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: true, flagged: 0 })
  })
})

describe('AC-046.6 — only Venue Staff can edit venues', () => {
  test('AC-046.6.15: someone who is not Venue Staff is told so, when opening or saving', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only Venue Staff can edit venues' } })
    expect(await loadVenueForEdit('venue-1')).toEqual({ ok: false, reason: messages.notVenueStaffEdit })
    expect(await updateVenue('venue-1', 'v1', VENUE)).toEqual({ ok: false, reason: messages.notVenueStaffEdit })
  })
})
