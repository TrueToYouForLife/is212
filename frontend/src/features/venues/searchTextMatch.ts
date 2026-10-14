/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * How the free-text venue filters compare values.
 *
 * `ilike '%...%'` only ignores case. It still treats "Level 2." and "level 2" as
 * different, and " main  hall " as different from "Main Hall", so a coordinator who
 * types a trailing full stop or a double space gets "No venues match" for a venue that
 * is sitting right there. Reducing both sides to their letters and digits removes every
 * one of those differences at once.
 *
 * This is why the keyword and location filters are applied in the browser rather than in
 * the query: the stored value still contains its punctuation, so a stripped search term
 * would not match it with `ilike` no matter how the pattern is written. The venue list is
 * small and bounded by the active-status filter, and the facility filter is already
 * applied here for a similar reason.
 */

/**
 * Letters and digits only, lower case. NFKD first so an accented character decomposes
 * and its mark is then dropped, rather than the whole character disappearing.
 */
export function normaliseForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Does `haystack` contain `needle`, ignoring case, spacing and punctuation? A blank or
 * punctuation-only search term matches everything: typing "." is not a filter.
 */
export function matchesText(haystack: string | null | undefined, needle: string): boolean {
  const wanted = normaliseForMatch(needle)
  if (wanted === '') return true
  return normaliseForMatch(haystack).includes(wanted)
}

/** True when any of the values matches. Used for "name or location". */
export function matchesAnyText(
  haystacks: readonly (string | null | undefined)[],
  needle: string,
): boolean {
  const wanted = normaliseForMatch(needle)
  if (wanted === '') return true
  return haystacks.some((value) => normaliseForMatch(value).includes(wanted))
}

/**
 * Two codes mean the same layout.
 *
 * This exists because `venues.layout` is unconstrained. `events.layout_preference` has a
 * foreign key to `layout_types` (0052) and `venue_layouts.layout` has one too (0022), but
 * `venues.layout` is plain `text`: 0019a filled it from a hand-edited array, verbatim, so
 * it holds `Hall` and `U-shape` where the catalogue holds `hall` and `u_shape`. A plain
 * `.eq()` matched neither, which meant the layout filter silently returned nothing for a
 * perfectly valid layout.
 *
 * NOTE: the database already has this reduction — `public.layout_code(raw text)` in 0022,
 * which 0022 and its trigger use to derive a code from a venue's layout. This function is
 * a second implementation of the same idea in TypeScript, and that duplication is the
 * reason it is called out here rather than left to be discovered. The two are not
 * interchangeable: `layout_code` collapses runs of punctuation to `_` and keeps them
 * (`u_shape`), while this deletes them (`ushape`). Each is only ever used to compare two
 * values that both went through it, so both are correct as keys — but do not mix them.
 *
 * The real fix is to normalise `venues.layout` and give it the same foreign key, after
 * which `.eq()` works in the query and this function can be deleted from the layout path.
 * That is deliberately not part of this change: it breaks about 178 database checks across
 * US10, US12, US15, US17 and US18, because ten fixture files insert the capitalised label
 * (`'Theatre'`) rather than the code. It needs its own ticket, which must also decide
 * whether `unspecified` stays a real layout option and check Venue Staff's write path,
 * since afterwards they must write `theatre` rather than `Theatre`.
 */
export function sameCode(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normaliseForMatch(left)
  const b = normaliseForMatch(right)
  return a !== '' && a === b
}
