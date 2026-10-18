# US46 Add and edit venue details (SCRUM-241): test cases

Built code-first in slices (trunk-based development): each slice is its own branch and PR,
merged when CI is green, with unfinished screens behind `VITE_FEATURE_VENUE_MANAGEMENT`.
Within a slice each acceptance criterion is coded and tested before the next, and code and
tests are committed together.

| Slice | ACs | Status |
|---|---|---|
| 1. Add a venue | AC-046.1, AC-046.3, AC-046.6 | implemented; automated cases pass |
| 2. Edit a venue, flag affected bookings | AC-046.2, AC-046.4 | not started |
| 3. Retire a venue | AC-046.5 | not started |

Test IDs follow `CLAUDE.md`: `AC-046.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-046.1.29, AC-046.2.1, AC-046.3.11,
AC-046.4.1, AC-046.5.1, AC-046.6.13.

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

## Manual test cases (shared Supabase, after 0064 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | With `VITE_FEATURE_VENUE_MANAGEMENT=true`, sign in as Venue Staff and open **Add venue**. Add a venue with two layouts. | "Venue added"; the venue appears on **Availability** and in venue search with its larger layout. |
| M2 | Try a capacity of 0, then a name another venue uses. | Each is refused with its reason; nothing is saved. |
| M3 | Sign in as an Operations Manager and open `/venues/new`. | Told adding venues is for Venue Staff. |

## Coverage and forced break

Slice 1: `venueManagementValidation.ts`, `venueManagementService.ts`, `VenueForm.tsx` and
`AddVenuePage.tsx` are at 100% statements, branches, functions and lines. SQL has no coverage
tool; 0064 is covered case by case above. The story's forced break is planned for slice 2,
which carries the booking-flagging logic.
