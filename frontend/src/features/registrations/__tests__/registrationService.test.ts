import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  REGISTRATION_SERVICE_MESSAGES as messages,
  loadMyRegistrations,
  loadOpenEvent,
  loadOpenEvents,
  registerForEvent,
  withdrawRegistration,
} from '../registrationService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventRow = {
  id: 'event-1',
  name: 'Data Workshop',
  event_type: 'Workshop',
  proposed_start: '2035-03-10T01:00:00Z',
  proposed_end: '2035-03-10T09:00:00Z',
  venue: 'Main Hall (Level 1)',
  registered: false,
}
const detailsRow = {
  ...eventRow,
  description: 'Hands-on data workshop',
  programme: '09:00 Welcome',
  prerequisites: 'Bring a laptop',
  full: false,
  waitlist_entry_id: null,
  waitlist_status: null,
  waitlist_position: null,
  offer_expires_at: null,
}
const answers = { phone: ' 9123 4567 ', dietaryRequirements: '', accessibilityNeeds: 'Ramp' }

const ok = (data: unknown) => ({ data, error: null })
const fails = (code: string, message = 'database error') => ({ data: null, error: { code, message } })

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AC-015.1: the Attendee views details of a confirmed event', () => {
  test('AC-015.1.6: maps an event\'s details, including prerequisites and venue', async () => {
    mocks.rpc.mockResolvedValue(ok([detailsRow]))

    const result = await loadOpenEvent('event-1')

    expect(mocks.rpc).toHaveBeenCalledWith('get_open_event', { p_event_id: 'event-1' })
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'event-1',
        name: 'Data Workshop',
        eventType: 'Workshop',
        start: '2035-03-10T01:00:00Z',
        end: '2035-03-10T09:00:00Z',
        venue: 'Main Hall (Level 1)',
        registered: false,
        description: 'Hands-on data workshop',
        programme: '09:00 Welcome',
        prerequisites: 'Bring a laptop',
        full: false,
        waitlist: null,
      },
    })
  })

  test('AC-015.1.7: an event that is not open is reported, not shown blank', async () => {
    mocks.rpc.mockResolvedValue(ok([]))
    await expect(loadOpenEvent('event-1')).resolves.toEqual({ ok: false, reason: messages.notOpen })
  })
})

describe('AC-015.2: the Attendee inputs the information required to register', () => {
  test('AC-015.2.7: registers through the database function with only the cleaned answers', async () => {
    mocks.rpc.mockResolvedValue(ok('registration-1'))

    await expect(registerForEvent('event-1', { ...answers, prerequisitesConfirmed: true }, { hasPrerequisites: true }))
      .resolves.toEqual({ ok: true })

    expect(mocks.rpc).toHaveBeenCalledWith('register_for_event', {
      p_event_id: 'event-1',
      p_phone: '9123 4567',
      p_dietary_requirements: null,
      p_accessibility_needs: 'Ramp',
      p_prerequisites_confirmed: true,
    })
  })

  test('AC-015.2.8: invalid answers never reach Supabase', async () => {
    const result = await registerForEvent('event-1', { phone: '' }, { hasPrerequisites: false })

    expect(result).toMatchObject({ ok: false, reason: messages.checkFields })
    expect(result.ok ? [] : result.issues?.map((issue) => issue.field)).toEqual(['phone'])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-015.2.19: a refusal because the caller is not an Attendee is explained', async () => {
    mocks.rpc.mockResolvedValue(fails('42501'))
    await expect(registerForEvent('event-1', answers, { hasPrerequisites: false }))
      .resolves.toEqual({ ok: false, reason: messages.notAttendee })
  })
})

describe('AC-015.4: registration is only offered where it is enabled', () => {
  test('AC-015.4.5: a refusal because registration is closed is explained', async () => {
    mocks.rpc.mockResolvedValue(fails('22000'))
    await expect(registerForEvent('event-1', answers, { hasPrerequisites: false }))
      .resolves.toEqual({ ok: false, reason: messages.registrationClosed })
  })
})

describe('AC-015.5: an Attendee cannot register twice for the same event', () => {
  test('AC-015.5.5: a duplicate is explained in friendly words', async () => {
    mocks.rpc.mockResolvedValue(fails('23505', 'duplicate key value violates unique constraint'))
    await expect(registerForEvent('event-1', answers, { hasPrerequisites: false }))
      .resolves.toEqual({ ok: false, reason: messages.duplicate })
  })
})

describe('AC-015.6: the Attendee sees events open for registration', () => {
  test('AC-015.6.6: maps the list in the order received', async () => {
    const second = { ...eventRow, id: 'event-2', name: 'Late Talk', venue: null, registered: true }
    mocks.rpc.mockResolvedValue(ok([eventRow, second]))

    const result = await loadOpenEvents()

    expect(mocks.rpc).toHaveBeenCalledWith('list_open_events')
    expect(result.ok && result.value.map((event) => [event.id, event.venue, event.registered]))
      .toEqual([['event-1', 'Main Hall (Level 1)', false], ['event-2', null, true]])
  })

  test('AC-015.6.7: a load failure returns a clear error and no data', async () => {
    mocks.rpc.mockResolvedValue(fails('PGRST000'))
    await expect(loadOpenEvents()).resolves.toEqual({ ok: false, reason: messages.loadFailed })
  })
})

describe('AC-015.7: the Attendee sees their registrations', () => {
  test('AC-015.7.5: maps registrations with readable statuses', async () => {
    const row = (status: string, registration: string, id: string) => ({
      registration_id: id,
      event_id: `event-${id}`,
      event_name: `Event ${id}`,
      proposed_start: '2035-03-10T01:00:00Z',
      proposed_end: null,
      venue: null,
      event_status: status,
      registration_status: registration,
    })
    mocks.rpc.mockResolvedValue(ok([
      row('confirmed', 'registered', '1'),
      row('completed', 'registered', '2'),
      row('cancelled', 'withdrawn', '3'),
    ]))

    const result = await loadMyRegistrations()

    expect(mocks.rpc).toHaveBeenCalledWith('list_my_registrations')
    expect(result.ok && result.value.map((r) => [r.eventStatusLabel, r.registrationStatusLabel])).toEqual([
      ['Confirmed', 'Registered'],
      ['Completed', 'Registered'],
      ['Cancelled', 'Withdrawn'],
    ])
  })
})

describe('AC-023.1: the Attendee withdraws their own registration', () => {
  test('AC-023.1.9: withdraws through the database function, sending only the registration id', async () => {
    mocks.rpc.mockResolvedValue(ok(null))

    await expect(withdrawRegistration('registration-1')).resolves.toEqual({ ok: true })

    expect(mocks.rpc).toHaveBeenCalledWith('withdraw_registration', { p_registration_id: 'registration-1' })
  })
})

describe("AC-023.5: nobody else's registration, nothing already withdrawn", () => {
  test.each([
    ['P0002', messages.withdrawNotFound, true],
    ['55000', messages.alreadyWithdrawn, true],
    ['22000', messages.cannotWithdraw, true],
    ['42501', messages.notAttendee, false],
    ['XX000', messages.withdrawFailed, false],
  ])('AC-023.5.8: error %s is explained, and only a changed registration asks for a reload', async (code, reason, stale) => {
    mocks.rpc.mockResolvedValue(fails(code))
    await expect(withdrawRegistration('registration-1')).resolves.toEqual({ ok: false, reason, stale })
  })
})
