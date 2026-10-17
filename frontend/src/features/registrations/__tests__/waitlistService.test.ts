import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  WAITLIST_MESSAGES, acceptWaitlistOffer, joinWaitlist, leaveWaitlist, loadMyWaitlist,
} from '../waitlistService'

/**
 * US16 (waiting list), service level. The database is the control (0058/0059); these cases pin
 * what the browser sends and what it tells the Attendee when the database refuses.
 */
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

const eventId = '16100000-0000-4000-8000-000000000001'
const entryId = '16200000-0000-4000-8000-000000000001'
const answers = { phone: ' 9123 4567 ', dietaryRequirements: '', accessibilityNeeds: 'Ramp' }

const ok = (data: unknown) => ({ data, error: null })
const fails = (code: string, extra: Record<string, string> = {}) => ({
  data: null, error: { code, message: 'database error', ...extra },
})

beforeEach(() => { vi.resetAllMocks() })

describe('AC-016.1: joining the waiting list of a full event', () => {
  test('AC-016.1.9: sends only the event id to join_waitlist', async () => {
    mocks.rpc.mockResolvedValue(ok(entryId))
    expect(await joinWaitlist(eventId)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('join_waitlist', { p_event_id: eventId })
  })

  test('AC-016.1.10: a refusal says why, and tells the page whether to reload', async () => {
    mocks.rpc.mockResolvedValue(fails('55000', { hint: 'not_full' }))
    expect(await joinWaitlist(eventId)).toEqual({ ok: false, stale: true, reason: WAITLIST_MESSAGES.notFull })

    mocks.rpc.mockResolvedValue(fails('22000'))
    expect(await joinWaitlist(eventId)).toEqual({ ok: false, stale: true, reason: WAITLIST_MESSAGES.notOpen })

    mocks.rpc.mockResolvedValue(fails('42501'))
    expect(await joinWaitlist(eventId)).toEqual({ ok: false, stale: false, reason: WAITLIST_MESSAGES.notAttendee })

    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await joinWaitlist(eventId)).toEqual({ ok: false, stale: false, reason: WAITLIST_MESSAGES.joinFailed })
  })
})

describe('AC-016.5: no joining twice, and not while registered', () => {
  test('AC-016.5.8: tells an attendee who is registered from one who is already waiting', async () => {
    mocks.rpc.mockResolvedValue(fails('23505', { hint: 'already_registered' }))
    expect(await joinWaitlist(eventId)).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.alreadyRegistered,
    })

    mocks.rpc.mockResolvedValue(fails('23505', { hint: 'already_waitlisted' }))
    expect(await joinWaitlist(eventId)).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.alreadyWaitlisted,
    })

    // The unique index's own error carries no hint: still the waiting-list wording, never a raw error.
    mocks.rpc.mockResolvedValue(fails('23505'))
    expect(await joinWaitlist(eventId)).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.alreadyWaitlisted,
    })
  })
})

describe('AC-016.2: leaving the waiting list', () => {
  test('AC-016.2.6: sends only the entry id to leave_waitlist', async () => {
    mocks.rpc.mockResolvedValue(ok(null))
    expect(await leaveWaitlist(entryId)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('leave_waitlist', { p_entry_id: entryId })
  })

  test('AC-016.2.7: an entry that is already gone reloads the page; other failures can be retried', async () => {
    mocks.rpc.mockResolvedValue(fails('P0002'))
    expect(await leaveWaitlist(entryId)).toEqual({ ok: false, stale: true, reason: WAITLIST_MESSAGES.gone })

    mocks.rpc.mockResolvedValue(fails('55000', { hint: 'left' }))
    expect(await leaveWaitlist(entryId)).toEqual({ ok: false, stale: true, reason: WAITLIST_MESSAGES.gone })

    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await leaveWaitlist(entryId)).toEqual({ ok: false, stale: false, reason: WAITLIST_MESSAGES.leaveFailed })
  })

  test('AC-016.2.8: maps the Attendee\'s waiting lists, including the queue position', async () => {
    mocks.rpc.mockResolvedValue(ok([{
      entry_id: entryId, event_id: eventId, event_name: 'Data Workshop',
      proposed_start: '2035-03-10T01:00:00Z', venue: 'Main Hall (Level 1)', status: 'waiting',
      queue_position: 3, offer_expires_at: null,
    }]))
    expect(await loadMyWaitlist()).toEqual({
      ok: true,
      value: [{
        entryId, eventId, eventName: 'Data Workshop', start: '2035-03-10T01:00:00Z',
        venue: 'Main Hall (Level 1)', status: 'waiting', position: 3, offerExpiresAt: null,
      }],
    })
    expect(mocks.rpc).toHaveBeenCalledWith('list_my_waitlist')
  })

  test('AC-016.2.9: a failed load says so without the raw error', async () => {
    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await loadMyWaitlist()).toEqual({ ok: false, reason: WAITLIST_MESSAGES.loadFailed })
  })
})

describe('AC-016.3: accepting an offered place', () => {
  test('AC-016.3.12: sends the entry and the trimmed answers to accept_waitlist_offer', async () => {
    mocks.rpc.mockResolvedValue(ok('16300000-0000-4000-8000-000000000001'))
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith('accept_waitlist_offer', {
      p_entry_id: entryId,
      p_phone: '9123 4567',
      p_dietary_requirements: null,
      p_accessibility_needs: 'Ramp',
      p_prerequisites_confirmed: false,
    })
  })

  test('AC-016.3.13: invalid answers are refused before any request, with the fields to fix', async () => {
    const result = await acceptWaitlistOffer(entryId, { ...answers, phone: 'abc' }, { hasPrerequisites: false })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.issues?.length).toBeGreaterThan(0)
    expect(!result.ok && result.reason).toBe(WAITLIST_MESSAGES.checkFields)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('AC-016.3.14: the database\'s own answer message is shown; an offer that is gone reloads the page', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Enter a phone number of 8 to 15 digits.' } })
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({
      ok: false, stale: false, reason: 'Enter a phone number of 8 to 15 digits.',
    })

    mocks.rpc.mockResolvedValue(fails('55000', { hint: 'waiting' }))
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.offerUnavailable,
    })

    mocks.rpc.mockResolvedValue(fails('P0002'))
    expect((await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).ok).toBe(false)

    mocks.rpc.mockResolvedValue(fails('22000'))
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.notOpen,
    })

    mocks.rpc.mockResolvedValue(fails('XX000'))
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({
      ok: false, stale: false, reason: WAITLIST_MESSAGES.acceptFailed,
    })
  })
})

describe('AC-016.4: an offer that was not accepted in time', () => {
  test('AC-016.4.8: no registration and no error means the offer lapsed, so the page reloads', async () => {
    mocks.rpc.mockResolvedValue(ok(null))
    expect(await acceptWaitlistOffer(entryId, answers, { hasPrerequisites: false })).toEqual({
      ok: false, stale: true, reason: WAITLIST_MESSAGES.offerUnavailable,
    })
  })
})
