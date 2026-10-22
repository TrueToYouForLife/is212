# US46 Add and edit venue details (SCRUM-241): test cases

Built code-first in slices (trunk-based development): each slice is its own branch and PR,
merged when CI is green, with unfinished screens behind `VITE_FEATURE_VENUE_MANAGEMENT`
until the last slice, which removed the flag.
Within a slice each acceptance criterion is coded and tested before the next, and code and
tests are committed together.

| Slice | ACs | Status |
|---|---|---|
| 1. Add a venue | AC-046.1, AC-046.3, AC-046.6 | merged (0064) |
| 2. Edit a venue, flag affected bookings | AC-046.2, AC-046.4 (and AC-046.6 for editing) | in review (0067) |
| 3. Retire a venue, remove the feature flag | AC-046.5 (and AC-046.6 for retiring) | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-046.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-046.1.29, AC-046.2.30, AC-046.3.11,
AC-046.4.18, AC-046.5.26, AC-046.6.22.

## Acceptance criteria (Jira)

- AC-046.1 Venue Staff can add a venue with its name, location, facilities, accessibility
  features, operating hours, and each supported layout with its capacity.
- AC-046.2 Venue Staff can edit any of these details.
- AC-046.3 Every supported layout must have a capacity of at least 1.
- AC-046.4 Editing a venue never changes the status of existing bookings; bookings that may
  now be unsuitable are flagged for review and their Coordinators notified.
- AC-046.5 Venue Staff can retire a venue: it no longer appears in venue search, its future
  bookings are flagged for review rather than cancelled, and their Coordinators are notified.
- AC-046.6 Only Venue Staff can add, edit or retire venues, and each change is recorded with
  who made it and when.

## Design decisions (slice 1)

| # | Decision | Why |
|---|---|---|
| D1 | Only Venue Staff write venues and layouts. 0064 removes the Operations Manager's write access from 0018/0022; they keep read access. | AC-046.6. The customer's roles (Week 4, Week 7) give venue management to Venue Staff; the Operations Manager (0006) is an oversight role. |
| D2 | Operating hours are one opening and one closing time per venue, on slot boundaries: opens 07:00, 13:00 or 19:00; closes 12:00, 18:00 or 24:00, after opening. Checked in the form and by a database constraint. | Booking is slot-based (AC-019.3), so hours that split a slot (09:00 to 17:00) would leave it unclear whether AM or PM is bookable. Hours that differ by day can be added if the customer asks. |
| D3 | Operating hours are stored and shown, not yet enforced on holds. | No AC asks for it. Slot-aligned hours make it a small change later. |
| D4 | A venue and all its layouts are saved by one database function, `add_venue()`, or not at all. | A venue saved without its layouts would be unbookable and invisible to suitability checks. |
| D5 | Layouts, facilities and accessibility features must come from the same catalogues events request from (`layout_types`, `facility_types`, `accessibility_types`). | A venue can only offer what an event can ask for, so search and suitability can match them. |
| D6 | The largest layout becomes the venue's primary layout (`venues.layout`/`capacity`, read by search), the first listed on a tie, stored as its code. | Search matches layouts by code; storing a label such as "Banquet (rounds)" would make 0022's sync trigger invent a new layout type. |
| D7 | Every change to a venue or its layouts is written to `venue_changes` by database triggers, with the signed-in user and time. Nobody can write or erase it from the app; only Venue Staff can read it. | AC-046.6. A trigger cannot be skipped by any path that writes venues. Changes made outside the app (seed data, migrations) are still recorded, with no user. |

## Automated test cases (slice 1)

Types: **integration (SQL)** runs against PostgreSQL with real RLS; **unit** is a pure module
or component; **unit (service)** is a service against the mocked Supabase client.

### AC-046.1 Venue Staff can add a venue with its details

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.1.1 | Venue Staff add a venue with name, location, facilities, accessibility, hours and each layout's capacity | integration (SQL) | normal | venue_management.sql |
| AC-046.1.2 | the largest layout becomes the primary layout search reads | integration (SQL) | normal | venue_management.sql |
| AC-046.1.3 | on a tie the first layout is primary; no facilities or accessibility is allowed; closing at midnight is allowed | integration (SQL) | boundary | venue_management.sql |
| AC-046.1.4 | hours must be on slot boundaries, closing after opening | integration (SQL) | conflict | venue_management.sql |
| AC-046.1.5 | a venue needs a name, a location and hours | integration (SQL) | failure | venue_management.sql |
| AC-046.1.6 | layouts, facilities and accessibility must come from the catalogues | integration (SQL) | failure | venue_management.sql |
| AC-046.1.7 | a name another venue uses is refused | integration (SQL) | conflict | venue_management.sql |
| AC-046.1.8 | a complete form becomes the venue to save, trimmed, capacities as numbers | unit | normal | venueManagementValidation.test.ts |
| AC-046.1.9 | a name and a location are required; spaces alone do not count | unit | failure | venueManagementValidation.test.ts |
| AC-046.1.10 | missing hours or hours between slots are refused | unit | boundary | venueManagementValidation.test.ts |
| AC-046.1.11 | closing must be after opening; Night through midnight is allowed | unit | boundary | venueManagementValidation.test.ts |
| AC-046.1.12 | every problem is reported at once | unit | failure | venueManagementValidation.test.ts |
| AC-046.1.13 | the venue and its layouts are sent in one call | unit (service) | normal | venueManagementService.test.ts |
| AC-046.1.14 | a signed-out user sends nothing | unit (service) | failure | venueManagementService.test.ts |
| AC-046.1.15 | a duplicate name and invalid hours are explained | unit (service) | conflict | venueManagementService.test.ts |
| AC-046.1.16 | the database's own refusal reasons are shown as they are | unit (service) | failure | venueManagementService.test.ts |
| AC-046.1.17 | an unexpected failure gives a general message and is logged | unit (service) | failure | venueManagementService.test.ts |
| AC-046.1.18 | layout options come from the catalogue, in order | unit (service) | normal | venueManagementService.test.ts |
| AC-046.1.19 | a failed or empty layout catalogue is reported | unit (service) | failure | venueManagementService.test.ts |
| AC-046.1.20 | filling in every detail submits the venue | unit | normal | VenueForm.test.tsx |
| AC-046.1.21 | opening and closing times can only be chosen on slot boundaries | unit | boundary | VenueForm.test.tsx |
| AC-046.1.22 | problems are shown next to their fields and nothing is submitted | unit | failure | VenueForm.test.tsx |
| AC-046.1.23 | a database refusal is shown; the button is disabled while saving | unit | failure | VenueForm.test.tsx |
| AC-046.1.24 | Venue Staff add a venue and are told it is in the catalogue | unit | normal | AddVenuePage.test.tsx |
| AC-046.1.25 | "Add another venue" opens an empty form | unit | normal | AddVenuePage.test.tsx |
| AC-046.1.26 | a refused venue keeps the form as typed and shows why | unit | failure | AddVenuePage.test.tsx |
| AC-046.1.27 | if layout options cannot load, the page says so instead of the form | unit | failure | AddVenuePage.test.tsx |
| AC-046.1.28 | leaving before layout options arrive does not update the page | unit | boundary | AddVenuePage.test.tsx |

### AC-046.3 Every supported layout has a capacity of at least 1

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.3.1 | below 1, fractional or missing capacity is refused; exactly 1 is accepted | integration (SQL) | boundary | venue_management.sql |
| AC-046.3.2 | a venue needs at least one layout, each listed once | integration (SQL) | failure | venue_management.sql |
| AC-046.3.3 | a venue with one invalid layout is not saved at all | integration (SQL) | failure | venue_management.sql |
| AC-046.3.4 | the database refuses a capacity below 1 even when written directly | integration (SQL) | conflict | venue_management.sql |
| AC-046.3.5 | capacities of 0, -1, 1.5, blank, text, 1e2 and +5 are refused | unit | boundary | venueManagementValidation.test.ts |
| AC-046.3.6 | a capacity of exactly 1 is accepted | unit | boundary | venueManagementValidation.test.ts |
| AC-046.3.7 | at least one layout, from the catalogue, listed once | unit | failure | venueManagementValidation.test.ts |
| AC-046.3.8 | only the rows with a problem are flagged, in order | unit | normal | venueManagementValidation.test.ts |
| AC-046.3.9 | an invalid capacity is flagged on its own row | unit | failure | VenueForm.test.tsx |
| AC-046.3.10 | the last layout cannot be removed; no more rows than layouts | unit | boundary | VenueForm.test.tsx |

### AC-046.6 Only Venue Staff change venues; each change records who and when

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.6.1 | no role but Venue Staff can add a venue, through the function or directly | integration (SQL) | conflict | venue_management.sql |
| AC-046.6.2 | the Operations Manager can no longer change venues or layouts | integration (SQL) | conflict | venue_management.sql |
| AC-046.6.3 | adding a venue records who added it, when, and each layout | integration (SQL) | normal | venue_management.sql |
| AC-046.6.4 | an edit records who, when, and each detail's old and new value; a no-op edit records nothing | integration (SQL) | boundary | venue_management.sql |
| AC-046.6.5 | changing or removing a layout records who and the capacity | integration (SQL) | normal | venue_management.sql |
| AC-046.6.6 | nobody can write or erase the history from the app; only Venue Staff can read it | integration (SQL) | conflict | venue_management.sql |
| AC-046.6.7 | a venue added outside the app is recorded with no user | integration (SQL) | boundary | venue_management.sql |
| AC-046.6.8 | a "not Venue Staff" refusal is explained | unit (service) | conflict | venueManagementService.test.ts |
| AC-046.6.9 | coordinators, Leads, organisers, operations managers, tech support and attendees are refused, and nothing loads | unit | conflict | AddVenuePage.test.tsx |
| AC-046.6.10 | while the session is loading, nothing is shown or loaded | unit | boundary | AddVenuePage.test.tsx |
| AC-046.6.11 | Venue Staff are offered "Add venue" once venue management is switched on | unit | normal | TopNav.test.tsx |
| AC-046.6.12 | other roles are never offered it | unit | conflict | TopNav.test.tsx |

0064 is replayed by the database runner before these tests, which also shows it is safe to replay.

## Design decisions (slice 2)

| # | Decision | Why |
|---|---|---|
| D8 | Reviews use the arrangement review records of US41 (0052) and US20 (0063): `arrangement_review_flags` and `arrangement_review_notifications`. 0067 adds `venue_change_id` as a third possible source, beside a change request and a planning update. | One place for a Coordinator to see and resolve every reason to recheck an arrangement, with the existing panel and `resolve_arrangement_review`. No change to US41's or US20's code. |
| D9 | Each review points at the `venue_changes` row that caused it, and is raised from 0064's history triggers. | Every path that changes a venue is reviewed, not only the edit page, and each flag says exactly which edit caused it. |
| D10 | Only what an edit takes away is reviewed: a requested layout's capacity lowered below the attendance, a requested layout removed, a required accessibility feature or facility removed, or hours that no longer cover a booked slot. Name and location changes are not reviewed. | AC-046.4 asks for bookings that may now be unsuitable. Flagging problems an edit did not cause would bury the real ones. |
| D11 | Only live bookings are reviewed: held and not lapsed, awaiting Venue Staff, or confirmed, for events that have not ended. | A cancelled booking, a lapsed hold or a past event has nothing left to rearrange. |
| D12 | One open venue review per booking and reason. A further edit of that kind updates the open review to the latest detail and points it at the newest edit, without a second notice (0052 keeps one notice per review). Once the Coordinator resolves it, a further edit is a new review. | A Coordinator never acts on figures a later edit replaced (review feedback, US20). |
| D13 | An event with no Coordinator is still flagged, with no notice; whoever the Lead assigns sees it. | Same as 0063's `record_arrangement_review`. |
| D14 | New reason `venue_hours_review` added to 0063's list. The other reasons (`venue_capacity`, `venue_layout_review`, `venue_accessibility_review`, `venue_facility_review`) are reused. | Operating hours (0064) had no reason of their own. |
| D15 | Saving checks a fingerprint of everything the form shows (`venue_edit_version`), and refuses with "changed by someone else" if it moved. | One person's edit never silently overwrites another's, including layout-only edits. |
| D16 | Adding and editing share one set of checks (`check_venue_input`), moved out of 0064's `add_venue` unchanged. | A venue is checked the same way however it is saved. Slice 1's tests still pass against it. |
| D17 | The nav item is now **Manage venues** (`/venues/manage`), listing every venue with an Edit link and an Add venue button. | One entry point for Venue Staff. AC-046.6.11/12 test the new label. |
| D18 | A venue added before 0064 opens with blank hours, which must be chosen before saving. A feature the catalogue no longer lists is left out and named on screen. | Saving would otherwise be refused for a value Venue Staff cannot see or fix. |

Known overlap: `event_requested_layout()` repeats the rule 0063 uses inline to decide which
layout an event needs. If US20 moves that rule into a function, both should call it.

## Automated test cases (slice 2)

### AC-046.2 Venue Staff can edit any of a venue's details

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.2.1 | a venue opens with every editable detail; an unknown venue is not found | integration (SQL) | normal | venue_edit.sql |
| AC-046.2.2 | name, location, accessibility and facilities can be changed | integration (SQL) | normal | venue_edit.sql |
| AC-046.2.3 | a layout can be added and a capacity changed; the largest becomes primary | integration (SQL) | normal | venue_edit.sql |
| AC-046.2.4 | removing a layout nobody booked is saved without a review | integration (SQL) | boundary | venue_edit.sql |
| AC-046.2.5 | an edit from an out-of-date copy is refused | integration (SQL) | conflict | venue_edit.sql |
| AC-046.2.6 | an edit is checked like a new venue; a refused edit changes nothing | integration (SQL) | failure | venue_edit.sql |
| AC-046.2.7 | renaming to another venue's name is refused | integration (SQL) | conflict | venue_edit.sql |
| AC-046.2.8 | the form opens with the current details, capacities as text | unit | normal | venueManagementValidation.test.ts |
| AC-046.2.9 | a venue without hours opens with them blank and must have them chosen | unit | boundary | venueManagementValidation.test.ts |
| AC-046.2.10 | a feature no longer in the catalogue is left out and named | unit | boundary | venueManagementValidation.test.ts |
| AC-046.2.11 | a venue with no location opens with it blank | unit | boundary | venueManagementValidation.test.ts |
| AC-046.2.12 | venues to manage are listed by name, retired included | unit (service) | normal | venueManagementService.test.ts |
| AC-046.2.13 | a failed list is reported and logged; an empty one is empty | unit (service) | failure | venueManagementService.test.ts |
| AC-046.2.14 | a venue opens with the version saving will check | unit (service) | normal | venueManagementService.test.ts |
| AC-046.2.15 | a missing venue, failed load or unexpected answer is reported | unit (service) | failure | venueManagementService.test.ts |
| AC-046.2.16 | every detail is saved in one call with the opened version | unit (service) | normal | venueManagementService.test.ts |
| AC-046.2.17 | an out-of-date edit is reported so it can be reloaded | unit (service) | conflict | venueManagementService.test.ts |
| AC-046.2.18 | not found, duplicate name and invalid hours are explained | unit (service) | failure | venueManagementService.test.ts |
| AC-046.2.19 | database reasons shown as they are; unexpected ones logged; signed out sends nothing | unit (service) | failure | venueManagementService.test.ts |
| AC-046.2.20 | Venue Staff see every venue with an Edit link and an Add venue button | unit | normal | ManageVenuesPage.test.tsx |
| AC-046.2.21 | a failed list is reported; an empty catalogue says so | unit | failure | ManageVenuesPage.test.tsx |
| AC-046.2.22 | leaving before the list arrives does not update the page | unit | boundary | ManageVenuesPage.test.tsx |
| AC-046.2.23 | the edit page opens with the venue's current details | unit | normal | EditVenuePage.test.tsx |
| AC-046.2.24 | saving sends the edits with the opened version | unit | normal | EditVenuePage.test.tsx |
| AC-046.2.25 | an out-of-date edit is explained; reloading shows the other change | unit | conflict | EditVenuePage.test.tsx |
| AC-046.2.26 | another refusal keeps the edits and shows why | unit | failure | EditVenuePage.test.tsx |
| AC-046.2.27 | a feature no longer in the catalogue is named before saving | unit | boundary | EditVenuePage.test.tsx |
| AC-046.2.28 | a venue or layout options that cannot load are reported | unit | failure | EditVenuePage.test.tsx |
| AC-046.2.29 | "Edit again" reopens the saved venue; leaving early does not update the page | unit | boundary | EditVenuePage.test.tsx |

### AC-046.4 An edit never changes a booking; possibly unsuitable bookings are flagged and their Coordinators notified

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.4.1 | lowering a capacity that still fits raises no review | integration (SQL) | boundary | venue_edit.sql |
| AC-046.4.2 | lowering a requested layout below attendance flags the booking and notifies its Coordinator | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.3 | other layouts, past events, cancelled bookings and lapsed holds are not flagged | integration (SQL) | boundary | venue_edit.sql |
| AC-046.4.4 | an event with no Coordinator is flagged with no one to notify | integration (SQL) | boundary | venue_edit.sql |
| AC-046.4.5 | a further edit of the same kind updates the open review to the latest figures instead of adding a second | integration (SQL) | conflict | venue_edit.sql |
| AC-046.4.6 | removing a requested layout flags the booking | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.7 | removing a required accessibility feature flags it; an unneeded one does not | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.8 | removing a required facility flags it; an unneeded one does not | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.9 | hours that no longer cover a booked slot flag it; hours that still do not | integration (SQL) | boundary | venue_edit.sql |
| AC-046.4.10 | only the assigned Coordinator sees the reviews and notices | integration (SQL) | conflict | venue_edit.sql |
| AC-046.4.11 | the Coordinator resolves a venue review like any other; the booking stays confirmed | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.12 | a direct change to the venue tables is reviewed too, once the earlier review is resolved | integration (SQL) | conflict | venue_edit.sql |
| AC-046.4.13 | after every edit, no booking's status, hold or slots changed | integration (SQL) | normal | venue_edit.sql |
| AC-046.4.17 | one booking reviewed for two reasons in one edit counts as one booking sent for review | integration (SQL) | boundary | venue_edit.sql |
| AC-046.4.14 | saving reports how many bookings were sent for review | unit (service) | normal | venueManagementService.test.ts |
| AC-046.4.15 | an answer without a count is read as nothing flagged | unit (service) | boundary | venueManagementService.test.ts |
| AC-046.4.16 | after saving, Venue Staff are told how many bookings were sent for review and that none changed | unit | normal | EditVenuePage.test.tsx |

### AC-046.6 Only Venue Staff edit venues; each edit recorded

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.6.13 | only Venue Staff can open a venue for editing or save an edit | integration (SQL) | conflict | venue_edit.sql |
| AC-046.6.14 | every saved edit is recorded with who, when and what changed | integration (SQL) | normal | venue_edit.sql |
| AC-046.6.15 | a "not Venue Staff" refusal is explained when opening or saving | unit (service) | conflict | venueManagementService.test.ts |
| AC-046.6.16 | other roles are told managing venues is for Venue Staff; nothing loads | unit | conflict | ManageVenuesPage.test.tsx |
| AC-046.6.17 | while the session loads, the list shows nothing | unit | boundary | ManageVenuesPage.test.tsx |
| AC-046.6.18 | other roles are told editing venues is for Venue Staff; nothing loads | unit | conflict | EditVenuePage.test.tsx |
| AC-046.6.19 | while the session loads, the edit page shows nothing | unit | boundary | EditVenuePage.test.tsx |

0067 is replayed by the database runner before these tests, which also shows it is safe to replay.

## Design decisions (slice 3)

| # | Decision | Why |
|---|---|---|
| D19 | Retiring needs a reason, which is stored on the venue (`retirement_note`), recorded in `venue_changes`, and passed to the affected Coordinators in their review. | A Coordinator told to find another venue should know why. |
| D20 | Retiring is a second, explicit step on the edit page: a reason, then "Confirm retirement". | It takes the venue out of search and sends every upcoming booking's Coordinator to rearrange; it should not happen by a slip. |
| D21 | Retirement reviews every live booking of an event that has not ended, with reason `venue_retired`, through the same arrangement review records as slice 2. No booking is cancelled. | AC-046.5: flagged for review rather than cancelled, Coordinators notified. |
| D22 | A retired venue cannot take new holds (0049's insert policy, with a venue check added). Search (US8, active venues only), suitability (US18) and availability (US19) already leave retired venues out. | A saved link or an old page must not book a retired venue. |
| D23 | A retired venue can still be opened and edited, shows that it is retired and why, and cannot be retired again. Reinstating is not in AC-046.5 and is not built. | Venue Staff may still need to correct its details; un-retiring is a separate decision for the customer. |
| D24 | 0067 and 0070 only ever widen the list of review reasons: each replaces it only if its own reason is missing. | Replaying an older migration must never drop reasons a newer one added. |
| D25 | In the database runner, US20's block (its tests and 0063's replay) now runs before US10's venue booking tests, followed by replays of 0067 and 0070. | 0063's replay restores a two-source check, which existing venue-change reviews would violate. US10's approval tests retire a venue, which now raises such reviews, so 0063 must be replayed before them. |
| D26 | `VITE_FEATURE_VENUE_MANAGEMENT` is removed: the pages and the Manage venues nav item are always on for Venue Staff. | US46 is complete. |

## Automated test cases (slice 3)

### AC-046.5 Venue Staff can retire a venue; it leaves search, its bookings are flagged not cancelled, Coordinators notified

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.5.1 | retiring needs a reason and an up-to-date copy; a refused retirement changes nothing | integration (SQL) | failure | venue_retire.sql |
| AC-046.5.2 | Venue Staff retire a venue with a reason and are told how many bookings went for review | integration (SQL) | normal | venue_retire.sql |
| AC-046.5.3 | a confirmed booking is flagged with the reason and its Coordinator notified | integration (SQL) | normal | venue_retire.sql |
| AC-046.5.4 | a request for an event with no Coordinator is flagged, with no one yet to notify | integration (SQL) | boundary | venue_retire.sql |
| AC-046.5.5 | past events, cancelled bookings and lapsed holds are not flagged | integration (SQL) | boundary | venue_retire.sql |
| AC-046.5.6 | retiring cancels nothing: statuses, holds and slots unchanged | integration (SQL) | normal | venue_retire.sql |
| AC-046.5.7 | the retirement is recorded with who, when and why | integration (SQL) | normal | venue_retire.sql |
| AC-046.5.8 | a retired venue cannot be retired again, and opens showing it is retired and why | integration (SQL) | conflict | venue_retire.sql |
| AC-046.5.9 | a retired venue cannot be held for a new event; an active one still can | integration (SQL) | conflict | venue_retire.sql |
| AC-046.5.10 | a retired venue is no longer active, so venue search no longer offers it | integration (SQL) | normal | venue_retire.sql |
| AC-046.5.11 | retiring needs a reason; spaces alone do not count | unit | failure | venueManagementValidation.test.ts |
| AC-046.5.12 | the reason is sent trimmed | unit | boundary | venueManagementValidation.test.ts |
| AC-046.5.13 | a venue opens with its retirement reason, or none | unit | boundary | venueManagementValidation.test.ts |
| AC-046.5.14 | retiring sends the reason with the opened version and reports how many were flagged | unit (service) | normal | venueManagementService.test.ts |
| AC-046.5.15 | retiring a venue someone just changed is reported as out of date | unit (service) | conflict | venueManagementService.test.ts |
| AC-046.5.16 | a missing venue, database reasons and unexpected failures are explained | unit (service) | failure | venueManagementService.test.ts |
| AC-046.5.17 | an answer without a count is nothing flagged; signed out sends nothing | unit (service) | boundary | venueManagementService.test.ts |
| AC-046.5.18 | retiring asks for a reason first | unit | failure | RetireVenuePanel.test.tsx |
| AC-046.5.19 | retiring needs an explicit confirmation; cancelling goes back | unit | normal | RetireVenuePanel.test.tsx |
| AC-046.5.20 | confirming retires the venue with the reason, trimmed | unit | normal | RetireVenuePanel.test.tsx |
| AC-046.5.21 | while retiring, neither confirming again nor cancelling is possible | unit | boundary | RetireVenuePanel.test.tsx |
| AC-046.5.22 | after retiring, Venue Staff are told the venue left search and how many bookings went for review | unit | normal | EditVenuePage.test.tsx |
| AC-046.5.23 | a retired venue opens saying so and why, with no way to retire it again | unit | conflict | EditVenuePage.test.tsx |
| AC-046.5.24 | a retired venue with no reason recorded still says it is retired | unit | boundary | EditVenuePage.test.tsx |
| AC-046.5.25 | a refused retirement is explained, with a reload when the venue changed | unit | failure | EditVenuePage.test.tsx |

### AC-046.6 Only Venue Staff retire venues

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-046.6.20 | only Venue Staff can retire a venue | integration (SQL) | conflict | venue_retire.sql |
| AC-046.6.21 | a "not Venue Staff" refusal is explained | unit (service) | conflict | venueManagementService.test.ts |

AC-046.6.11 and AC-046.6.12 (TopNav.test.tsx) now test the Manage venues item without the
feature flag. 0070 is replayed by the database runner before these tests.

## Manual test cases (shared Supabase, after 0064, 0067 and 0070 are applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | With `VITE_FEATURE_VENUE_MANAGEMENT=true`, sign in as Venue Staff and open **Add venue**. Add a venue with two layouts. | "Venue added"; the venue appears on **Availability** and in venue search with its larger layout. |
| M2 | Try a capacity of 0, then a name another venue uses. | Each is refused with its reason; nothing is saved. |
| M3 | Sign in as an Operations Manager and open `/venues/new`. | Told adding venues is for Venue Staff. |
| M4 | As Venue Staff, open **Manage venues**, edit a venue that has a confirmed booking, and lower its booked layout's capacity below that event's attendance. | "Venue updated" says 1 booking was sent for review; the booking is still confirmed. |
| M5 | Sign in as that event's Coordinator and open the event. | The arrangement review panel shows the capacity reason; resolving it works as for any other review. |
| M6 | Open the same venue in two tabs, save in one, then save in the other. | The second save is refused as changed by someone else; "Reload the venue" shows the first save. |
| M7 | As Venue Staff, open a venue with a confirmed booking, enter a reason, click **Retire venue…**, then **Confirm retirement**. | "Venue retired"; the venue no longer appears in venue search or availability; the booking is still confirmed. |
| M8 | Sign in as that event's Coordinator and open the event. | The arrangement review panel shows the retirement with its reason. |
| M9 | As a Coordinator, open the retired venue's timetable from an old link and try to hold a slot. | The hold is refused. |

## Coverage and forced break

Slice 1: `venueManagementValidation.ts`, `venueManagementService.ts`, `VenueForm.tsx` and
`AddVenuePage.tsx` are at 100% statements, branches, functions and lines.

Slice 2: the same files plus `ManageVenuesPage.tsx` and `EditVenuePage.tsx` are at 100%.

Slice 3: the same files plus `RetireVenuePanel.tsx` are at 100%.

SQL has no coverage tool; 0064, 0067 and 0070 are covered case by case above.

Forced break (the story's one, in slice 2, which carries the booking-review logic): in
`0067_venue_edit_review.sql` the capacity check (`and b.expected_attendance > v_capacity`)
was replaced with `and false`. The runner failed at AC-046.4.2; the file was then restored.
Log: `docs/test-evidence/us46/AC-046.4.2-forced-break.log`.
