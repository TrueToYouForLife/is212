import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { VENUE_MANAGEMENT_MESSAGES as messages, addVenue, loadLayoutOptions } from '../venueManagementService'
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
