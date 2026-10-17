import { describe, expect, test } from 'vitest'
import { canAcceptOffer } from '../validation'

/** US16 AC-016.3 / AC-016.4: the pure rule that decides whether the accept form is shown. */
const now = new Date('2035-03-01T00:00:00Z')

describe('AC-016.3: an offer can be accepted until its deadline', () => {
  test('AC-016.3.16: an offer whose deadline is still ahead can be accepted', () => {
    expect(canAcceptOffer({ status: 'offered', offerExpiresAt: '2035-03-04T00:00:00Z' }, now)).toBe(true)
  })

  test('AC-016.3.17: someone still waiting has nothing to accept', () => {
    expect(canAcceptOffer({ status: 'waiting', offerExpiresAt: null }, now)).toBe(false)
  })
})

describe('AC-016.4: a lapsed offer cannot be accepted', () => {
  test('AC-016.4.9: an offer past its deadline cannot, even if the page still says offered', () => {
    expect(canAcceptOffer({ status: 'offered', offerExpiresAt: '2035-02-28T00:00:00Z' }, now)).toBe(false)
  })

  test('AC-016.4.10: the deadline is half-open: an offer expiring exactly now has lapsed', () => {
    expect(canAcceptOffer({ status: 'offered', offerExpiresAt: '2035-03-01T00:00:00Z' }, now)).toBe(false)
    expect(canAcceptOffer({ status: 'offered', offerExpiresAt: '2035-03-01T00:00:01Z' }, now)).toBe(true)
  })

  test('AC-016.4.11: an entry already marked expired, or with no deadline, cannot be accepted', () => {
    expect(canAcceptOffer({ status: 'expired', offerExpiresAt: '2035-03-04T00:00:00Z' }, now)).toBe(false)
    expect(canAcceptOffer({ status: 'offered', offerExpiresAt: null }, now)).toBe(false)
  })
})
