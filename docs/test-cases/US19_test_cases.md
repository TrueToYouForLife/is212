# US19 View venue availability calendar (SCRUM-64): test cases

Status: **implemented; automated cases pass, manual cases not yet run.** Built code-first
(team decision, Week 7): each acceptance criterion was coded and its tests written straight
after, committed together. The forced break for this story is AC-019.2.1 (log in the evidence
folder). On the final run the full app suite is 965 tests; this story adds 52 of them, plus 3
manual cases that need the shared Supabase project.

Implementation is frontend only, in `frontend/src/features/venues/`: `venueAvailability.ts`,
`availabilityDates.ts`, `venueAvailabilityService.ts`, `components/VenueAvailabilityGrid.tsx`,
`pages/VenueAvailabilityPage.tsx`, plus the `/venues/availability` route and nav items. No
migration: the existing RLS already lets Coordinators and Venue Staff read every venue's slots.

Test IDs follow `CLAUDE.md`: `AC-019.Y.Z`, where Y is the acceptance criterion in Jira order and
Z numbers the tests within it. Z is unique across the story and increases top to bottom within
each test file.

## Acceptance criteria (Jira)

- AC-019.1 Authorised internal staff, such as Venue Staff, are able to view venue availability
  across relevant time and dates.
- AC-019.2 Existing bookings and events that have been confirmed should be reflected as
  blocked-out slots.
- AC-019.3 Venue availability should be viewed in sections of 3: AM (7am-12pm), PM (1pm-6pm),
  Night (7pm-12am). Full-day booking uses all three slots.

## Design decisions

| # | Decision | Why |
|---|---|---|
| D1 | Venue Staff and Event Coordinators can open the calendar; every other role is told it is not for them and nothing is loaded. | AC-019.1 names Venue Staff; Coordinators already read the same data for booking. No Week 7 change needs another role to see it, and both roles already have read access through RLS (0018), so no migration. |
| D2 | All venues for one week: each venue is a group of three rows (AM, PM, Night), one column per day. | Staff can scan down a day for a free venue or along a row for one venue's week. A real table, not three slots squeezed into one cell, so screen readers get venue, slot and date for every cell. |
| D3 | Read-only. Coordinators open a venue's own timetable (US10) from its name to place a hold, only while `VITE_FEATURE_VENUE_BOOKING` is on. | One place to book; this page is for seeing. No link to a page that is switched off. |
| D4 | Cells use the same states, labels and colours as the US10 timetable, built by its `buildTimetable()`. The colours moved to `timetableStyles.ts` so both grids share them. | Both calendars read the same. The US10 grid's behaviour is unchanged (its tests still pass). |
| D5 | Setup and turnaround cells are striped as well as coloured. | So they are not told apart by colour alone. |
| D6 | Retired venues are hidden; venues under maintenance are shown with a label. | A retired venue cannot be booked; a venue under maintenance still has bookings staff need to see. |
| D7 | Fail closed: a failed read of venues, claims or slot times shows an error, never an empty grid. | An empty grid reads as "every venue is free". |
| D8 | All venues' claims come from one query for the week, not one query per venue. | One round trip regardless of how many venues there are. |

## Known limitations

- Venue Staff may not see which event holds a cell: `events` has no Venue Staff read policy as of
  0048, so the reference comes back empty. The cell still shows as booked, which is what
  AC-019.2 asks for. Checked manually in M2.
- Week 7 change #1 (configurable setup and turnaround times) is US47. This calendar shows
  whatever setup and turnaround slots a booking has claimed.

## Automated test cases

Types: **unit** (pure module or component, no Supabase), **unit (service)** (service against
the mocked Supabase client). Scenarios: normal, boundary, conflict, failure.

### AC-019.1 Staff can view availability across dates

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-019.1.1 | a signed-out user reads nothing, and nothing is queried | unit (service) | failure | venueAvailabilityService.test.ts |
| AC-019.1.2 | reads every non-retired venue by name, and every claim in the week only, in one query | unit (service) | normal | venueAvailabilityService.test.ts |
| AC-019.1.3 | bookings and blocks from joined rows land on their own venue's cells | unit (service) | normal | venueAvailabilityService.test.ts |
| AC-019.1.4 | a booking whose event cannot be read still blocks its slot | unit (service) | boundary | venueAvailabilityService.test.ts |
| AC-019.1.5 | a failed venue read is reported and logged, never shown as a free week | unit (service) | failure | venueAvailabilityService.test.ts |
| AC-019.1.6 | a failed claims read is reported, never shown as a free week | unit (service) | failure | venueAvailabilityService.test.ts |
| AC-019.1.7 | with no slot times loaded nothing is queried, and the failure is reported | unit (service) | failure | venueAvailabilityService.test.ts |
| AC-019.1.8 | an empty payload is an empty calendar, not an error | unit (service) | boundary | venueAvailabilityService.test.ts |
| AC-019.1.9 | moving a week at a time crosses month and year ends | unit | boundary | availabilityDates.test.ts |
| AC-019.1.10 | "this week" starts on today in Singapore, already tomorrow from 16:00 UTC | unit | boundary | availabilityDates.test.ts |
| AC-019.1.11 | each day is headed with its weekday and date | unit | normal | availabilityDates.test.ts |
| AC-019.1.12 | for coordinators, each venue name opens that venue's timetable | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.1.13 | for Venue Staff, names are plain text; location and maintenance are shown | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.1.14 | Venue Staff see every venue for the week starting today in Singapore | unit | normal | VenueAvailabilityPage.test.tsx |
| AC-019.1.15 | coordinators see it too, and can open a venue's timetable from its name | unit | normal | VenueAvailabilityPage.test.tsx |
| AC-019.1.16 | with venue booking switched off, coordinators get no timetable link | unit | boundary | VenueAvailabilityPage.test.tsx |
| AC-019.1.17 | organisers, Leads, operations managers, tech support and attendees are refused, and nothing loads | unit | conflict | VenueAvailabilityPage.test.tsx |
| AC-019.1.18 | while the session is loading, nothing is shown or loaded | unit | boundary | VenueAvailabilityPage.test.tsx |
| AC-019.1.19 | next, previous and this week move the calendar a week at a time | unit | normal | VenueAvailabilityPage.test.tsx |
| AC-019.1.20 | choosing a date starts the week there; clearing the date keeps the current week | unit | boundary | VenueAvailabilityPage.test.tsx |
| AC-019.1.21 | slot times are read once and reused between weeks | unit | normal | VenueAvailabilityPage.test.tsx |
| AC-019.1.22 | a failed load shows the error instead of a calendar; slot times are retried | unit | failure | VenueAvailabilityPage.test.tsx |
| AC-019.1.23 | with no active venues, the page says so | unit | boundary | VenueAvailabilityPage.test.tsx |
| AC-019.1.24 | an answer for a week the user has moved away from is ignored | unit | conflict | VenueAvailabilityPage.test.tsx |
| AC-019.1.25 | Venue Staff and coordinators are offered Availability in the nav | unit | normal | TopNav.test.tsx |
| AC-019.1.26 | other roles are not offered it | unit | conflict | TopNav.test.tsx |

### AC-019.2 Bookings and confirmed events are blocked out

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-019.2.1 | each venue gets only its own bookings, never another venue's | unit | conflict | venueAvailability.test.ts |
| AC-019.2.2 | confirmed is blocked out; a hold or request is taken but distinct | unit | normal | venueAvailability.test.ts |
| AC-019.2.3 | a Venue Staff block shows as blocked, with its reason | unit | normal | venueAvailability.test.ts |
| AC-019.2.4 | a slot left by a cancelled, rejected or expired booking reads as free | unit | boundary | venueAvailability.test.ts |
| AC-019.2.5 | a venue with nothing booked is a fully free week | unit | boundary | venueAvailability.test.ts |
| AC-019.2.6 | a booking for an unlisted (retired) venue is not drawn anywhere | unit | conflict | venueAvailability.test.ts |
| AC-019.2.7 | venues are listed by name, whatever order they arrive in | unit | normal | venueAvailability.test.ts |
| AC-019.2.8 | the week spans the requested days in order, across a month end | unit | boundary | venueAvailability.test.ts |
| AC-019.2.9 | each kind of occupancy has its own wording, on screen and for screen readers | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.2.10 | a Venue Staff block shows as blocked, with its reason, in the grid | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.2.11 | the key names every state, including setup and turnaround | unit | normal | VenueAvailabilityGrid.test.tsx |

### AC-019.3 Each day is shown as AM, PM and Night

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-019.3.1 | every venue has AM, PM and Night rows in order, even when slots are defined out of order | unit | boundary | VenueAvailabilityGrid.test.tsx |
| AC-019.3.2 | a full-day booking fills all three slots, with setup and turnaround either side | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.3.3 | one column per day of the week, headed with weekday and date | unit | normal | VenueAvailabilityGrid.test.tsx |
| AC-019.3.4 | each venue shows 21 cells for the week, three a day | unit | boundary | VenueAvailabilityGrid.test.tsx |

## Manual test cases (shared Supabase project)

| ID | Steps | Expected |
|---|---|---|
| M1 | Sign in as Venue Staff. Open **Availability**. | Every active venue is listed for the week starting today, AM/PM/Night for each day. |
| M2 | With a confirmed booking and a tentative hold in the shown week, view as Venue Staff and as a Coordinator. | Confirmed cells read "Booked", held cells "Held", their setup/turnaround cells striped. Note whether Venue Staff see the event reference (see Known limitations). |
| M3 | Block a venue for one slot (US12), then reload Availability. | That cell reads "Blocked" with the reason. |

## Coverage

All new and changed files are at 100% statements, branches, functions and lines:
`venueAvailability.ts`, `availabilityDates.ts`, `venueAvailabilityService.ts`,
`timetableStyles.ts`, `VenueAvailabilityGrid.tsx`, `VenueTimetableGrid.tsx`,
`VenueAvailabilityPage.tsx`. `App.tsx` and `TopNav.tsx` sit outside the coverage scope
(`vite.config.ts` covers `src/features/**`); the nav items are still tested (AC-019.1.25/26).

## Forced break

In `venueAvailability.ts`, every venue was given every venue's claims
(`claimsByVenue.get(venue.id) ?? []` replaced with `claims`). AC-019.2.1 and AC-019.2.6 failed;
the code was then restored. Logs: `docs/test-evidence/us19/AC-019.2.1-forced-break.log` and `AC-019.2.1-restored-pass.log`.
