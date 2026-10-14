import { describe, expect, test } from 'vitest'
import {
  matchesAnyText, matchesText, normaliseForMatch, sameCode,
} from '../searchTextMatch'

/**
 * PURE. How the free-text venue filters compare values, with no Supabase anywhere near
 * them. These are the cases `ilike '%...%'` gets wrong: it ignores case and nothing else,
 * so a trailing full stop or a double space used to produce "No venues match" for a venue
 * that was sitting right there.
 */

describe('AC-008.1 — free-text filters ignore case, spacing and punctuation', () => {
  test.each([
    ['AC-008.1.1', 'Main Hall', 'main hall'],
    ['AC-008.1.2', 'Main Hall', 'MAIN HALL'],
    ['AC-008.1.3', 'Main Hall', '  main   hall  '],
    ['AC-008.1.4', 'Level 2', 'level 2.'],
    ['AC-008.1.5', 'Hall A', 'halla'],
  ])('%s: "%s" is found by "%s"', (_id, stored, typed) => {
    expect(matchesText(stored, typed)).toBe(true)
  })

  test('AC-008.1.6: a filter made only of spaces or punctuation matches everything', () => {
    // Otherwise typing a stray "." would hide every venue, which reads as a broken page.
    expect(matchesText('Main Hall', '   ')).toBe(true)
    expect(matchesText('Main Hall', '.')).toBe(true)
    expect(matchesText('Main Hall', '')).toBe(true)
  })

  test('AC-008.1.7: a term that is genuinely absent still does not match', () => {
    expect(matchesText('Main Hall', 'annex')).toBe(false)
  })

  test('AC-008.1.8: a missing value matches nothing except a blank term', () => {
    expect(matchesText(null, 'hall')).toBe(false)
    expect(matchesText(undefined, 'hall')).toBe(false)
    expect(matchesText(null, '')).toBe(true)
  })

  test('AC-008.1.9: "name or location" matches when either one does', () => {
    expect(matchesAnyText(['Main Hall', 'Level 2'], 'level2')).toBe(true)
    expect(matchesAnyText(['Main Hall', 'Level 2'], 'main')).toBe(true)
    expect(matchesAnyText(['Main Hall', 'Level 2'], 'basement')).toBe(false)
  })

  test('AC-008.1.10: an accented character matches its unaccented spelling', () => {
    expect(matchesText('Café Terrace', 'cafe')).toBe(true)
  })

  test('AC-008.1.11: reduction keeps letters and digits only', () => {
    expect(normaliseForMatch(' Level-2.  Block/B ')).toBe('level2blockb')
    expect(normaliseForMatch('...')).toBe('')
    expect(normaliseForMatch(null)).toBe('')
  })
})

describe('AC-008.2 — a layout code matches however the venue spells it', () => {
  test.each([
    ['AC-008.2.1', 'u_shape', 'U-shape'],
    ['AC-008.2.2', 'hall', 'Hall'],
    ['AC-008.2.3', 'theatre', 'theatre'],
  ])('%s: the catalogue code %s matches the stored value %s', (_id, code, stored) => {
    // venues.layout was repaired from older data by 0019a and can hold "Hall" or
    // "U-shape", while layout_types holds "hall" and "u_shape". Both reduce to one key.
    expect(sameCode(code, stored)).toBe(true)
  })

  test('AC-008.2.4: different layouts still do not match', () => {
    expect(sameCode('theatre', 'banquet')).toBe(false)
  })

  test('AC-008.2.5: a missing code never matches, not even another missing one', () => {
    // Two unknowns are not the same layout, so "no layout recorded" must not pass the
    // filter for an event that did ask for one.
    expect(sameCode(null, null)).toBe(false)
    expect(sameCode('', 'theatre')).toBe(false)
    expect(sameCode('theatre', null)).toBe(false)
  })
})
