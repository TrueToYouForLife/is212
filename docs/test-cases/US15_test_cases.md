# US15 Register for a Confirmed Event (SCRUM-22): test cases

Status: **implemented; all 67 cases pass.** The table was approved on 7 October and the tests
were committed failing (commit `a44c16d`) before any implementation: 65 of 67 failed for the
expected reasons, and AC-015.1.5 and .3.5 already passed because they guard protections that
exist today. One test was then corrected with approval (AC-015.5.4, see "Changes after
approval"). On the final run all 34 SQL cases (44 checks) and 33 app tests pass; the full
suites total 826 app tests and 462 database checks. Implementation: migration
`0043_event_registrations.sql` (commit `881f73c`) and `frontend/src/features/registrations/`.
Live checks on shared Supabase need 0042 and 0043 applied first.

Test IDs follow `CLAUDE.md`: `AC-015.Y.Z`, where Y is the acceptance criterion in Jira order
and Z numbers the tests within it. Z is unique across the story and increases top to bottom
within each test file.

## Design the tests assume (7 October)

| # | Design | Source |
|---|---|---|
| D1 | "Registration enabled" is the existing `events.registration_required` (0001). The organiser sets it in the request form; US52 will give coordinators an on/off screen. No new flag. | Existing schema |
| D2 | **Open for registration** = status `confirmed`, `registration_required = true`, and `proposed_start` still in the future. Enforced in the database by the registration function, not only hidden in the UI. | AC-015.4, AC-015.6; Q4 |
| D3 | New migration `0043_event_registrations.sql`: an `event_registrations` table (event, attendee, status, answers, times). Status is `registered` now; `withdrawn` is allowed by the constraint so US23 can add withdrawal without a schema change. | Brief; US23 |
| D4 | A **unique index on (event, attendee) where status = 'registered'** enforces AC-015.5. A withdrawn registration does not block registering again (Q3). | AC-015.5 |
| D5 | Registering only through one database function, `register_for_event`. It checks the caller is an Attendee, the event is open (D2) and the answers are present, then inserts. Browsers have no insert, update or delete rights on the table. | Brief, key rules |
| D6 | Attendees never read `events`, `venues` or `venue_bookings` directly. Three read-only functions return public fields only: `list_open_events`, `get_open_event` and `list_my_registrations`. | Brief, key rules; Q7 |
| D7 | Public event fields: name, event type, description, programme, start and end, registration prerequisites, and venue name and location from **confirmed** venue bookings (or none). Hidden: purpose, expected attendance, reference, organiser, layout, equipment, accessibility and special arrangements requests, bookings, audit records. | Q7 |
| D8 | A new optional `events.registration_prerequisites` text field holds the prerequisites shown in AC-015.1. No screen edits it yet; it is set by an administrator until US52's coordinator screen. | Q2 |
| D9 | The registration form asks for a **phone number (required)**, **dietary requirements (optional)**, **accessibility needs (optional)**, and an **"I meet the prerequisites" confirmation, required only when the event has prerequisites**. Name and email come from the account. | Q1 |
| D10 | The confirmation email is queued in `notification_outbox` by an AFTER INSERT trigger on `event_registrations`, in the same transaction, and sent by the existing `send-review-notifications` Edge Function. If queueing fails, the registration rolls back. No US4 code changes. | AC-015.3; Q8 |
| D11 | Attendees see the event's current status as Confirmed, Completed or Cancelled: the only statuses a registered event can reach (0004 transitions). Registration status shows as Registered (Withdrawn after US23). | Q5 |
| D12 | US29's `/events/open` placeholder becomes the AC-015.6 list (no second list). Details at `/events/open/:id`; "My registrations" at `/registrations`. All dates in Singapore time through `formatDateTime`. | Brief |

## Assumptions (to confirm with the team or customer)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | Phone numbers are 8 to 15 digits after removing spaces, hyphens and one leading `+`. No country-specific rule. | .2.2–.2.5, .2.14 |
| A2 | Events that have already started are not open for registration, even if still Confirmed. | .4.3, .6.1 |
| A3 | Only Attendees register. Organisers, coordinators, managers, venue and technical staff are refused, including an organiser for their own event. | .2.18–.2.19 |
| A4 | Venue is shown only from confirmed venue bookings; held or pending ones show as "Venue to be confirmed". Several confirmed venues are listed together. | .1.3, .1.9 |
| A5 | Any signed-in user may call the open-events list and details (public information), but only Attendees can register. Visitors who are not signed in get nothing. | .6.5 |
| A6 | There is no screen to edit `registration_prerequisites` yet (D8). | .1.1, .1.9 |
| A7 | The email is plain text, like the other queued emails: event name, start in Singapore time, venue, and a pointer to My registrations. Real delivery is checked manually, as for US4/US7/US14. | .3.1, .3.6 |

## Fixtures (database tests, disposable Docker database only)

| Fixture | Definition |
|---|---|
| Users | `A1`, `A2` attendees; `O1` organiser (role set explicitly, US29); `C1` coordinator; `M1` operations manager; `V1` venue staff; `T1` tech support |
| `E-OPEN` | Confirmed, registration enabled, starts in 2035, prerequisites "Bring a laptop", confirmed booking at `HALL` (name "Main Hall", location "Level 1") |
| `E-OPEN2` | Confirmed, registration enabled, starts earlier in 2035 than `E-OPEN`, no prerequisites, only a held booking |
| `E-CLOSED` | Confirmed, registration **disabled** |
| `E-STATUS` | One event per other status (draft, submitted, under_review, approved, planning, completed, cancelled, rejected), registration enabled |
| `E-PAST` | Confirmed, registration enabled, started one minute ago |

App tests (Vitest) mock Supabase, as the existing tests do.

## Planned test files

| Layer | File |
|---|---|
| SQL | `backend/supabase/tests/event_registrations.sql` (Docker runner; the concurrency case uses `dblink`, as US14 does) |
| Vitest | `frontend/src/features/registrations/__tests__/validation.test.ts`, `registrationService.test.ts`, `RegistrationForm.test.tsx`, `OpenEventDetailsPage.test.tsx`, `MyRegistrationsPage.test.tsx`; `frontend/src/features/events/__tests__/OpenEventsPage.test.tsx` (US29, extended); `frontend/src/components/layout/__tests__/TopNav.test.tsx` |

---

## AC-015.1: Attendee can view details of a confirmed event, including prerequisites and required information

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.1.1 | 015.1 | SQL | An open event's public details are returned | `E-OPEN` | As `A1`, call `get_open_event(E-OPEN)` | none | One row: name, event type, description, programme, start, end, prerequisites "Bring a laptop", venue "Main Hall (Level 1)", not yet registered | **Pass** |
| AC-015.1.2 | 015.1 | SQL | Details contain no internal fields | `E-OPEN` | Inspect the function's result columns | none | No purpose, expected attendance, reference, organiser, layout, equipment, accessibility or special arrangements columns | **Pass** |
| AC-015.1.3 | 015.1 | SQL | Boundary: only confirmed venue bookings count as the venue | `E-OPEN2` has only a held booking | Call `get_open_event(E-OPEN2)` | none | Venue is null | **Pass** |
| AC-015.1.4 | 015.1 | SQL | Events that are not open reveal nothing | `E-CLOSED`, `E-STATUS` (approved, draft) | Call `get_open_event` for each | none | No rows | **Pass** |
| AC-015.1.5 | 015.1 | SQL | Permission denied: an Attendee cannot read events, venues or bookings directly | `E-OPEN` | As `A1`, select from `events` and `venue_bookings` | none | 0 rows from each | **Pass** |
| AC-015.1.6 | 015.1 | Vitest | The service maps an event's details | mocked `rpc` | `loadOpenEvent(id)` | one row | Typed details, including prerequisites and venue | **Pass** |
| AC-015.1.7 | 015.1 | Vitest | Failure: an event that is not open is reported, not shown blank | mocked `rpc` returns no rows | `loadOpenEvent(id)` | none | Error "This event is not open for registration." | **Pass** |
| AC-015.1.8 | 015.1 | Vitest | The details page shows the event, its prerequisites and the information needed to register | mocked service | Render `/events/open/:id` as `A1` | details with prerequisites | Name, start and end in Singapore time, venue, description, programme, "Bring a laptop", and the registration form's fields | **Pass** |
| AC-015.1.9 | 015.1 | Vitest | Boundary: no prerequisites and no venue yet | mocked details with both null | Render | none | "No prerequisites for this event." and "Venue to be confirmed"; no prerequisites confirmation in the form | **Pass** |

## AC-015.2: Attendee can input the information required to register

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.2.1 | 015.2 | Vitest | Valid answers are accepted and cleaned | none | `validateRegistration(input, { hasPrerequisites: false })` | phone " +65 9123 4567 ", dietary "  ", accessibility "Wheelchair" | Valid; phone "+65 9123 4567", dietary null, accessibility "Wheelchair" | **Pass** |
| AC-015.2.2 | 015.2 | Vitest | Missing phone is rejected | none | same | phone "" | "Enter a phone number." | **Pass** |
| AC-015.2.3 | 015.2 | Vitest | A phone with letters is rejected | none | same | "9123 ABCD" | "Enter a phone number of 8 to 15 digits." | **Pass** |
| AC-015.2.4 | 015.2 | Vitest | Boundary: 7 digits rejected, 8 accepted (A1) | none | same | "9123456", "91234567" | Rejected; accepted | **Pass** |
| AC-015.2.5 | 015.2 | Vitest | Boundary: 15 digits accepted, 16 rejected (A1) | none | same | "+123456789012345", "+1234567890123456" | Accepted; rejected | **Pass** |
| AC-015.2.6 | 015.2 | Vitest | Prerequisites must be confirmed only when the event has them | none | same, with and without prerequisites | confirmation false | Rejected with "Confirm that you meet the prerequisites." when the event has them; accepted when it has none | **Pass** |
| AC-015.2.7 | 015.2 | Vitest | The service registers through the database function with only the answers | mocked `rpc` | `registerForEvent(eventId, answers)` | valid answers | `rpc('register_for_event', { p_event_id, p_phone, p_dietary_requirements, p_accessibility_needs, p_prerequisites_confirmed })`; no attendee id or status sent | **Pass** |
| AC-015.2.8 | 015.2 | Vitest | Invalid answers never reach Supabase | mocked `rpc` | `registerForEvent` | phone "" | Field errors returned; `rpc` not called | **Pass** |
| AC-015.2.9 | 015.2 | Vitest | Filling in and submitting the form registers with the cleaned answers | form for an event with prerequisites | Type phone, tick the confirmation, submit | valid answers | Service called once with the cleaned answers | **Pass** |
| AC-015.2.10 | 015.2 | Vitest | Invalid answers show field errors and are not sent | form | Submit with an empty phone and no confirmation | none | Errors next to Phone and the confirmation; service not called | **Pass** |
| AC-015.2.11 | 015.2 | Vitest | Failure: a registration error is shown and the answers are kept | mocked failure | Submit valid answers | reason "Something went wrong" | Alert with the reason; fields keep their values; button enabled again | **Pass** |
| AC-015.2.12 | 015.2 | SQL | A valid registration is stored for the caller | `E-OPEN` | As `A1`, call `register_for_event` with valid answers | phone "91234567", prerequisites confirmed | One row: attendee `A1`, status `registered`, answers stored, `registered_at` set | **Pass** |
| AC-015.2.13 | 015.2 | SQL | The database refuses a blank phone | `E-OPEN2` | As `A2`, register with phone "  " | blank | Refused (22023); no row | **Pass** |
| AC-015.2.14 | 015.2 | SQL | The database refuses a phone that is not 8 to 15 digits (A1) | `E-OPEN2` | As `A2`, register | "12345" | Refused (22023); no row | **Pass** |
| AC-015.2.15 | 015.2 | SQL | The database requires the prerequisites confirmation only when there are prerequisites | `E-OPEN` (has), `E-OPEN2` (none) | As `A2`, register for each with the confirmation false | false | `E-OPEN` refused (22023); `E-OPEN2` accepted | **Pass** |
| AC-015.2.16 | 015.2 | SQL | Permission denied: registrations cannot be written directly | `A1` registered for `E-OPEN` | As `A1`: insert a row; update own status; delete own row | forged row | Insert refused (42501); update and delete refused or affect 0 rows; row unchanged | **Pass** |
| AC-015.2.17 | 015.2 | SQL | The attendee is always the caller | as above | Inspect the function's parameters and the stored row | none | No parameter accepts an attendee id; `attendee_id` = caller | **Pass** |
| AC-015.2.18 | 015.2 | SQL | Permission denied: other roles cannot register (A3) | `E-OPEN` | Call `register_for_event` as `O1`, `C1`, `M1`, `V1`, `T1` | valid answers | Each refused (42501); no rows | **Pass** |
| AC-015.2.19 | 015.2 | Vitest | A role refusal is explained | mocked 42501 | `registerForEvent` | valid answers | "Only attendees can register for events." | **Pass** |

## AC-015.3: Attendee receives an email confirmation upon successful registration

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.3.1 | 015.3 | SQL | A successful registration queues one confirmation email to the attendee | after .2.12 | Inspect `notification_outbox` | none | Exactly one `pending` row for `E-OPEN` to `A1`'s email; subject names the event; body has the event name, start in Singapore time and "Main Hall (Level 1)" | **Pass** |
| AC-015.3.2 | 015.3 | SQL | A refused registration queues nothing | closed and duplicate attempts (.4.1, .5.1) | Count outbox rows before and after | none | No new rows | **Pass** |
| AC-015.3.3 | 015.3 | SQL | Boundary: no confirmed venue says so in the email | `A2` registers for `E-OPEN2` (.2.15) | Inspect its outbox row | none | Body says "Venue to be confirmed" | **Pass** |
| AC-015.3.4 | 015.3 | SQL | Failure: if the email cannot be queued, the registration rolls back | a temporary check on the outbox that rejects the row | As `A2`, register for `E-OPEN` | valid answers | Refused; no registration and no outbox row; check removed afterwards | **Pass** |
| AC-015.3.5 | 015.3 | SQL | Permission denied: attendees cannot read the email queue | after .3.1 | As `A1`, select from `notification_outbox` | none | Refused (42501): browsers have no grant on the queue | **Pass** |
| AC-015.3.6 | 015.3 | Vitest | After registering, the page says a confirmation email is on its way | mocked success | Submit valid answers | none | Status "You're registered. A confirmation email is on its way." with a link to My registrations | **Pass** |

## AC-015.4: Registration is only offered for events where registration is enabled

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.4.1 | 015.4 | SQL | A confirmed event with registration disabled refuses registration | `E-CLOSED` | As `A1`, register | valid answers | Refused (22000); no row | **Pass** |
| AC-015.4.2 | 015.4 | SQL | Every status other than confirmed refuses registration | `E-STATUS` | As `A1`, register for each | valid answers | All eight refused (22000); no rows | **Pass** |
| AC-015.4.3 | 015.4 | SQL | Boundary: an event that has started refuses registration (A2) | `E-PAST` | As `A1`, register | valid answers | Refused (22000); no row | **Pass** |
| AC-015.4.4 | 015.4 | SQL | An event that does not exist refuses registration | none | As `A1`, register for a random id | valid answers | Refused (22000) | **Pass** |
| AC-015.4.5 | 015.4 | Vitest | A refusal because registration is closed is explained | mocked 22000 | `registerForEvent` | valid answers | "Registration is not open for this event." | **Pass** |
| AC-015.4.6 | 015.4 | Vitest | The details page for an event that is not open shows no form | mocked load error | Render `/events/open/:id` | none | "This event is not open for registration." and a link back to open events; no form | **Pass** |

## AC-015.5: An Attendee cannot register twice for the same event

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.5.1 | 015.5 | SQL | Conflict: a second registration by the same attendee is refused | after .2.12 | As `A1`, register for `E-OPEN` again | valid answers | Refused (23505); still one registration and one email | **Pass** |
| AC-015.5.2 | 015.5 | SQL | Other combinations are allowed | `A1` registered for `E-OPEN` | `A1` registers for `E-OPEN2`; `A2` registers for `E-OPEN` | valid answers | Both succeed | **Pass** |
| AC-015.5.3 | 015.5 | SQL | A withdrawn registration does not block a new one (US23 design) | `A1` on `E-OPEN2` set to `withdrawn` as admin | As `A1`, register for `E-OPEN2` again | valid answers | Succeeds; one `registered` and one `withdrawn` row | **Pass** |
| AC-015.5.4 | 015.5 | SQL | Concurrency: two simultaneous registrations create only one | new attendee `A3`, `E-OPEN` | Two `dblink` sessions register at once | valid answers | Exactly one row for `A3`; the other is refused | **Pass** |
| AC-015.5.5 | 015.5 | Vitest | A duplicate is explained in friendly words | mocked 23505 | `registerForEvent` | valid answers | "You are already registered for this event." | **Pass** |
| AC-015.5.6 | 015.5 | Vitest | Someone already registered sees that, not the form | mocked details with `registered: true` | Render `/events/open/:id` | none | "You're registered for this event." and a link to My registrations; no form | **Pass** |
| AC-015.5.7 | 015.5 | Vitest | Two quick clicks send one registration | form; service still pending | Click Register twice | valid answers | Service called once; button disabled while saving | **Pass** |

## AC-015.6: Attendee can see events open for registration and open one to view its details

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.6.1 | 015.6 | SQL | Only open events are listed | all fixtures | As `A1`, call `list_open_events()` | none | Exactly `E-OPEN2` and `E-OPEN`; none of `E-CLOSED`, `E-STATUS`, `E-PAST` | **Pass** |
| AC-015.6.2 | 015.6 | SQL | Soonest first | as above | same | none | `E-OPEN2` before `E-OPEN` | **Pass** |
| AC-015.6.3 | 015.6 | SQL | Each row has only public fields and its venue | as above | Inspect | none | id, name, event type, start, end, venue ("Main Hall (Level 1)" or null); no internal columns | **Pass** |
| AC-015.6.4 | 015.6 | SQL | The list shows whether the caller is registered | `A1` registered for `E-OPEN` | As `A1`, list | none | `E-OPEN` marked registered; `E-OPEN2` not | **Pass** |
| AC-015.6.5 | 015.6 | SQL | Permission denied: visitors who are not signed in get nothing (A5) | none | As `anon`, call `list_open_events()` and `get_open_event` | none | Refused (42501) | **Pass** |
| AC-015.6.6 | 015.6 | Vitest | The service maps the list | mocked `rpc` | `loadOpenEvents()` | 2 rows | Typed rows in the order received | **Pass** |
| AC-015.6.7 | 015.6 | Vitest | Failure: the list cannot load | mocked error | `loadOpenEvents()` | none | Clear error result, no partial data | **Pass** |
| AC-015.6.8 | 015.6 | Vitest | The page lists each open event and links to its details | mocked service; signed-in attendee | Render `/events/open` | 2 events | Each shows name, start in Singapore time and venue (or "Venue to be confirmed"), linking to `/events/open/:id`; a registered event says "Registered" | **Pass** |
| AC-015.6.9 | 015.6 | Vitest | Boundary: nothing open | mocked empty list | Render | none | "No events are open for registration right now." | **Pass** |
| AC-015.6.10 | 015.6 | Vitest | Failure: a load error is shown | mocked error | Render | none | Alert with the error; no list | **Pass** |
| AC-015.6.11 | 015.6 | Vitest | Opening an event goes to its details page | mocked list and details | Click an event | none | Its details page is shown | **Pass** |
| AC-015.6.12 | 015.6 | Vitest | After a load error, Try again loads the list | mocked error, then success | Render; click Try again | none | The list appears and the error goes | **Pass** (failed first, commit `3ade5a0`) |

## AC-015.7: Attendee can see a list of their registrations

| Test ID | AC | Layer | Scenario | Preconditions | Steps | Test data | Expected result | Result |
|---|---|---|---|---|---|---|---|---|
| AC-015.7.1 | 015.7 | SQL | Only the caller's registrations are listed, with the required details | `A1` and `A2` both registered | As `A1`, call `list_my_registrations()` | none | Only `A1`'s rows, each with event name, start, end, venue, event status and registration status | **Pass** |
| AC-015.7.2 | 015.7 | SQL | Permission denied: another attendee's registrations are invisible | as above | As `A1`, select from `event_registrations` | none | Only `A1`'s rows; none of `A2`'s | **Pass** |
| AC-015.7.3 | 015.7 | SQL | The current event status follows the event | `E-OPEN` set to cancelled as admin | As `A1`, list | none | That registration shows event status `cancelled`, still listed | **Pass** |
| AC-015.7.4 | 015.7 | SQL | Boundary: a non-attendee has no registrations | none | As `O1`, list | none | 0 rows | **Pass** |
| AC-015.7.5 | 015.7 | Vitest | The service maps registrations with readable statuses | mocked `rpc` | `loadMyRegistrations()` | confirmed, completed, cancelled; registered, withdrawn | Labels Confirmed, Completed, Cancelled; Registered, Withdrawn | **Pass** |
| AC-015.7.6 | 015.7 | Vitest | The page shows each registration's event name, date, venue, event status and registration status | mocked service | Render `/registrations` | 2 registrations | All five details for each, dates in Singapore time | **Pass** |
| AC-015.7.7 | 015.7 | Vitest | Boundary: no registrations yet | mocked empty list | Render | none | "You have not registered for any events yet." with a link to open events | **Pass** |
| AC-015.7.8 | 015.7 | Vitest | Failure: a load error is shown | mocked error | Render | none | Alert with the error; no list | **Pass** |
| AC-015.7.9 | 015.7 | Vitest | Attendees are offered My registrations in the navigation; organisers are not | attendee, organiser profiles | Render the top navigation | none | Attendee sees "My registrations" → `/registrations`; organiser does not | **Pass** |
| AC-015.7.10 | 015.7 | Vitest | After a load error, Try again loads the registrations | mocked error, then success | Render `/registrations`; click Try again | none | The registrations appear and the error goes | **Pass** (failed first, commit `3ade5a0`) |
| AC-015.7.11 | 015.7 | Vitest | An Attendee's Home also links to My registrations | attendee profile | Render Home | attendee | "My registrations" links to `/registrations` | **Pass** (failed first, commit `4a1ecad`) |
| AC-015.7.12 | 015.7 | Vitest | A Confirmed event that has not started has a details page to link to | pure rule `hasEventDetailsPage` | Call it with a future Confirmed event | start after now | true | **Pass** |
| AC-015.7.13 | 015.7 | Vitest | Boundary: an event that started or starts exactly now, or is cancelled or completed, has none | pure rule | Call it for each | start equal to now; started a minute ago; cancelled; completed | false for each | **Pass** |
| AC-015.7.14 | 015.7 | Vitest | On My registrations, a Confirmed event that has not started links to its details | mocked service | Render the page as an Attendee | one future Confirmed registration | The event name is a link to `/events/open/<event id>` | **Pass** |
| AC-015.7.15 | 015.7 | Vitest | Boundary: a cancelled or already-started event is plain text, not a dead link | mocked service | Render the page | a cancelled and a started registration | Names shown, no link for either | **Pass** |

---

## Changes after approval

- **AC-015.5.4 (8 October, approved):** the test ran the two-session race and counted the
  registrations in one SQL statement. A statement cannot see writes made by functions it calls,
  so the count always read 0 and the test failed even though the race behaved correctly (second
  session blocked, then refused as a duplicate; one row). The race now runs as its own statement
  and the count follows it, the same lesson recorded for US14. What the test checks is unchanged.

- **AC-015.6.12 and .7.10 added (8 October, in-sprint UX finish):** both list pages said "Please
  try again" on a load error but offered no way to. A Try again button now reloads the list. The
  tests were written and shown failing first (commit `3ade5a0`). Larger UX improvements (card
  redesign, details layout, form reassurance, Upcoming/Past split) were left for the product
  backlog to protect the sprint goal.

- **AC-015.7.11 added (8 October):** follow-up to the US29 Attendee Home defect. Once US15's
  My registrations page exists, the Attendee Home links to it as well as to Browse events.

## Regression and changes to existing tests (approved 7 October)

- **All existing app tests and database checks must still pass** (793 app tests, 418 database
  checks before US15).
- **One US29 test changes.** `OpenEventsPage.test.tsx` AC-029.4.6 expects the placeholder text
  "will appear here". Once `/events/open` lists real events, the test must mock the new service
  and expect the list's empty-state message ("No events are open for registration right now.").
  Its intent is unchanged: a signed-in Attendee lands on the events-open-for-registration page.
  AC-029.4.7 and .4.8 (redirect and loading) are unaffected.

## Coverage summary

| AC | SQL | Vitest | Count |
|---|---|---|---|
| AC-015.1 | .1.1–.1.5 | .1.6–.1.9 | 9 |
| AC-015.2 | .2.12–.2.18 | .2.1–.2.11, .2.19 | 19 |
| AC-015.3 | .3.1–.3.5 | .3.6 | 6 |
| AC-015.4 | .4.1–.4.4 | .4.5–.4.6 | 6 |
| AC-015.5 | .5.1–.5.4 | .5.5–.5.7 | 7 |
| AC-015.6 | .6.1–.6.5 | .6.6–.6.12 | 12 |
| AC-015.7 | .7.1–.7.4 | .7.5–.7.11 | 11 |
| **Total** | **34** | **36** | **70** |

Required categories, by test ID:

- **Open list shows only Confirmed + registration enabled:** .6.1 (excludes draft, approved, cancelled, disabled, started)
- **Database refuses non-Confirmed or registration-disabled events:** .4.1, .4.2, .4.3
- **Valid registration; missing or invalid answers rejected (form):** .2.9, .2.12; .2.2–.2.6, .2.10
- **Second registration refused (SQL):** .5.1, .5.4
- **Email queued on success, not on failure:** .3.1, .3.2, .3.4
- **My registrations: own only, with all five details:** .7.1, .7.6
- **RLS: cannot read or create another Attendee's registrations:** .7.2, .2.16, .2.17
- **RLS: non-Attendee roles cannot register:** .2.18
- **Internal information hidden:** .1.2, .1.4, .1.5, .3.5, .6.3
- **Boundary:** .1.3, .1.9, .2.4, .2.5, .3.3, .4.3, .6.9, .7.4, .7.7
- **Failure or conflict:** .1.7, .2.11, .3.4, .5.1, .5.4, .6.7, .6.10, .7.8
