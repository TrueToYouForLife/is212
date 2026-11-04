# US11 — Place Tentative Hold on Venue

Catalogue checked: 2 November 2026.

## Scope and evidence

This catalogue maps existing test-source IDs to their AC numbers, assertions and files.
Descriptions follow the current test titles/assertion labels; parameter rows keep their
existing IDs. Counts are unique source IDs, not a count of runtime executions or a new
coverage measurement. Shared cross-story assertions may appear in both relevant catalogues.

This is a documentation update. It does not claim fresh automated passes, manual
acceptance, deployed migrations or email delivery. Unit tests exercise pure logic or mock
external services; component tests render UI with their source's mocks; SQL/shell
integration tests use the disposable database runners. Existing evidence and historical
checkpoints remain in their original documents. Manual results are valid only where an
actual execution/report is recorded.

Historical labels refer to the original hold/booking rules. US49's multiple-booking
requirements and US47's quarter-hour buffers are documented under their own IDs; this
catalogue does not reinstate the old one-hold-per-event or AM/PM/Night rules. In particular,
a source ID here is not proof that every current Jira AC has a separate implementation.

## Acceptance-criterion coverage (added 3 November 2026)

The table below is the AC-to-source direction, which the index's traceability claim does not
cover: the index checks that every source ID appears in a catalogue, not that every Jira AC has
a source ID. Criteria are SCRUM-16's, including AC-011.10 added from US18 on 5 October 2026.

| AC | Automated coverage | Where |
| --- | --- | --- |
| AC-011.1 place a hold for an approved event | yes, component | AC-011.1.1 to .1.3 |
| AC-011.2 one hold or booking per slot | **no AC-011 ID** | the rule is in `holdRules.ts`; the clash is enforced by the `venue_slot_claims` primary key and tested as AC-009 in `venue_booking_conflicts.sql` |
| AC-011.3 setup/turnaround slots held too, across days | **no AC-011 ID** | `slots.ts`, tested as AC-009; quarter-hour buffers are US47's |
| AC-011.4 at most one active hold per event | **no AC-011 ID** | `ACTIVE_HOLD_STATUSES` and `0036`'s unique index, tested as AC-009; superseded in part by US49 |
| AC-011.5 shows as "Tentatively held" | yes, component | AC-011.5.14 to .5.20 |
| AC-011.6 expires after N days | yes, component | AC-011.6.12 to .6.13 |
| AC-011.7 convert to a booking request | yes, component | AC-011.7.2 |
| AC-011.8 placer or Venue Staff may release | yes, component | AC-011.8.9 to .8.10 |
| AC-011.9 released when the event closes | yes, integration (added with `0124`) | AC-011.9.1 to .9.7 in `venue_hold_release.sql`; see the defect below |
| AC-011.10 suitability check before a hold | yes, component (added with the wiring) | AC-011.10.1 to .10.8 in `VenueTimetableSuitability.test.tsx`; see below |

Until `0124`, every AC-011 ID was a component test and no SQL case carried an AC-011 ID, which
is why the `0035` trigger went years of migrations without coverage under this story's numbering.
`venue_hold_release.sql` is the first, and AC-011.2 to AC-011.4 are still traced only through
other stories' IDs.

### AC-011.9 — the status list was left behind by two later stories

`release_holds_on_event_close()` in `0035` fired only when the new status was `cancelled` or
`rejected`:

```sql
if new.status not in ('cancelled', 'rejected') then return new; end if;
```

The criterion says "cancelled, **postponed** or **withdrawn**", and both of those statuses
postdate `0035`. They are not equally serious:

- **`postponed` (US38, `0119`) was a reachable defect.** `0119` allows `planning -> postponed`
  and a hold is legal in `planning`, so a Coordinator could reach it from their own screens. The
  hold and its slot claims survived, and AC-011.2 refused any other event's hold on those slots
  until the hold lapsed three days later. `0120` (US21) does not close this: it releases on
  cancellation only, and for `pending_approval` and `confirmed` bookings rather than `held`.
- **`withdrawn` (US22, `0066`) is not reachable, and is included as hardening.** A hold may only
  be created while its event is `approved` or `planning` — enforced in the database by
  `bookings_insert_coordinator` (`0036`, carried forward by `0049`), not only by the client's
  `BOOKABLE_EVENT_STATUSES` — and `0119` allows `withdrawn` only from `submitted` or
  `under_review`. No transition returns an approved event to either, so the two sets never
  intersect. `0124` covers it anyway so that widening US22 later cannot silently reopen this
  defect; AC-011.9.4 forces the status as an administrator and says so.

`0124` widens the list to `('cancelled', 'rejected', 'withdrawn', 'postponed')`. `rejected` is
kept although AC-011.9 does not name it: it has been released since `0035`, and dropping it would
be a silent change to a path this story does not own.

Next free ID: AC-011.9.8.

### AC-011.10 — the parts existed but nothing connected them

`assessVenueForBooking` (`suitabilityService.ts`) and `UnsuitableVenueAlert`
(`components/UnsuitableVenueAlert.tsx`) are both written and both tested, and the alert already
renders the criterion's "Choose another venue" and "Book anyway" buttons. Neither is reached from
the hold flow: `VenueTimetablePage.tsx` calls `holdVenue` directly, and `assessVenueForBooking`
has no production caller at all, despite its own comment describing it as "the one-venue check a
booking screen runs before placing a hold or request".

The wiring adds the gate to `VenueTimetablePage.tsx`: the hold button now calls
`assessVenueForBooking(eventId, venueId, slots)` first, and an `unsuitable` or `unavailable`
verdict renders `UnsuitableVenueAlert` in place of the button. "Book anyway" places the hold
without re-checking, and "Choose another venue" dismisses it. Two decisions worth defending:

- **A check that cannot run fails open.** Suitability is advice — that is why "Book anyway"
  exists — so an advisory read that breaks must not deny a venue the database would accept, and
  the same verdict is available on the suitability page. AC-011.10.7 and .10.8 cover a refused
  and a thrown check. This also keeps the shared `VenueBookingPages.test.tsx` green: it does not
  mock the suitability service, so the real one runs there and takes this path.
- **A verdict is dropped when the event or the space changes.** Layout and attendance are two of
  the things suitability is judged on, so an open alert would otherwise let the coordinator
  override a verdict for a space they have since changed (AC-011.10.5).

An `unavailable` venue needs no special case here: `UnsuitableVenueAlert` already withholds
"Book anyway" for that verdict, because the database would refuse the hold anyway (AC-011.10.6).

Next free ID: AC-011.10.9.

## Existing cases (15 source IDs)

| Test ID | AC | Classification | Scenario / expected assertion | Test source |
| --- | --- | --- | --- | --- |
| AC-011.1.1 | 1 | Component — Happy path | holding sends the event and venue, and no slots, because the event decides them | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L169) |
| AC-011.1.2 | 1 | Component — Happy path / Boundary | a successful hold confirms, says when it expires, and reloads the calendar | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L176) |
| AC-011.1.3 | 1 | Component — Happy path | with no event chosen there is nothing to hold | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L196) |
| AC-011.5.14 | 5 | Component — Happy path | draws one column per date and one row per display section | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L52) |
| AC-011.5.15 | 5 | Component — Happy path | a held slot reads as "Tentatively held", its buffer says so too | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L58) |
| AC-011.5.16 | 5 | Component — Happy path | a free slot reads as available | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L63) |
| AC-011.5.17 | 5 | Component — Happy path | each cell is announced with its date, slot and state | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L67) |
| AC-011.5.18 | 5 | Component — Happy path | an occupied cell shows whose event holds it | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L71) |
| AC-011.5.19 | 5 | Component — Happy path | draws the venue’s calendar for the coming week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L155) |
| AC-011.5.20 | 5 | Component — Negative | a calendar that cannot be loaded says so rather than showing a free week | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L201) |
| AC-011.6.12 | 6 | Component — Happy path / Boundary | a live hold says how long is left before it expires | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L235) |
| AC-011.6.13 | 6 | Component — Negative | a hold whose time has run out says so and cannot be submitted | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L240) |
| AC-011.7.2 | 7 | Component — Happy path | submitting a live hold sends it for review and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L248) |
| AC-011.8.9 | 8 | Component — Happy path | releasing a hold frees it and reloads the list | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L256) |
| AC-011.8.10 | 8 | Component — Negative | a refused release says why instead of failing silently | [frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingPages.test.tsx#L264) |
