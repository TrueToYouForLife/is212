import { beforeEach, describe, expect, test, vi } from 'vitest'
import { REGISTRATION_SERVICE_MESSAGES, loadOpenEvent, registerForEvent } from '../registrationService'

/** US16: what the registration service now tells the page about a full event and a queue. */
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const row = {
  id: 'event-1', name: 'Data Workshop', event_type: 'Workshop',
  proposed_start: '2035-03-10T01:00:00Z', proposed_end: '2035-03-10T09:00:00Z',
  venue: 'Main Hall (Level 1)', registered: false, description: null, programme: null, prerequisites: null,
  full: true, waitlist_entry_id: null, waitlist_status: null, waitlist_position: null, offer_expires_at: null,
}
const answers = { phone: '91234567', dietaryRequirements: '', accessibilityNeeds: '', prerequisitesConfirmed: false }

beforeEach(() => { vi.resetAllMocks() })

describe('AC-016.1: a full event', () => {
  test('AC-016.1.11: the event page is told when the event is full', async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null })
    const result = await loadOpenEvent('event-1')
    expect(result.ok && result.value.full).toBe(true)
    expect(result.ok && result.value.waitlist).toBeNull()
  })

  test('AC-016.1.12: registering for an event that filled up meanwhile says to join the waiting list', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '53000', message: 'This event is full' } })
    expect(await registerForEvent('event-1', answers, { hasPrerequisites: false })).toEqual({
      ok: false, reason: REGISTRATION_SERVICE_MESSAGES.full,
    })
  })
})

describe('AC-016.2: the Attendee\'s place in the queue', () => {
  test('AC-016.2.10: the event page gets the Attendee\'s position while they wait', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      ...row, waitlist_entry_id: 'entry-1', waitlist_status: 'waiting', waitlist_position: 2,
    }], error: null })
    const result = await loadOpenEvent('event-1')
    expect(result.ok && result.value.waitlist).toEqual({
      entryId: 'entry-1', status: 'waiting', position: 2, offerExpiresAt: null,
    })
  })
})

describe('AC-016.3: an offered place', () => {
  test('AC-016.3.15: the event page gets the deadline while a place is held', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      ...row, waitlist_entry_id: 'entry-1', waitlist_status: 'offered', waitlist_position: null,
      offer_expires_at: '2035-03-05T01:00:00Z',
    }], error: null })
    const result = await loadOpenEvent('event-1')
    expect(result.ok && result.value.waitlist).toEqual({
      entryId: 'entry-1', status: 'offered', position: null, offerExpiresAt: '2035-03-05T01:00:00Z',
    })
  })
})

describe('AC-016.5: waitlisted attendees cannot register directly', () => {
  test('AC-016.5.9: a waitlisted attendee is told they are already on the list, not that they are registered', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'x', hint: 'already_waitlisted' } })
    expect(await registerForEvent('event-1', answers, { hasPrerequisites: false })).toEqual({
      ok: false, reason: REGISTRATION_SERVICE_MESSAGES.alreadyWaitlisted,
    })

    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'x' } })
    expect(await registerForEvent('event-1', answers, { hasPrerequisites: false })).toEqual({
      ok: false, reason: REGISTRATION_SERVICE_MESSAGES.duplicate,
    })
  })
})
