# US16 Join Event Waiting List: test cases

Status: **implemented, including the Coordinator override (SCRUM-154) and the expiry timer
(SCRUM-153); all 123 automated cases pass (17 October 2026).** 62 SQL cases (in `waiting_list.sql`,
`waitlist_override.sql` and `waitlist_expiry_job.sql`), run in a disposable Docker database through
`bash backend/supabase/tests/run_change_request_review.sh` (whole suite, exit 0), and 61 app tests
(Vitest). `0058`, `0059` and `0060` were applied to shared Supabase by the team; `0062` is not yet
applied. Seven manual cases are still to be run. The Coordinator names on request cards (`0061`) are a
US17 AC4 refinement with its own cases in `docs/us17-assignment.md`.
Code was written before the tests, at the team's request, so there is no red-green record.

Test IDs follow `CLAUDE.md`: `AC-016.Y.Z`, where Y is the acceptance criterion in Jira order and Z
numbers the tests within it. Z is unique across the story. The SQL file uses the lower numbers of each
criterion and the app tests continue from them.

| Level | Meaning |
|---|---|
| Integration (SQL) | A real PostgreSQL with RLS, triggers and the migrations; the database is the control. |
| Unit | One function, no database or UI: a pure rule, or a service with Supabase mocked. |
| Component | A React component or page with its services mocked. |
| E2E (manual) | The real app against the shared Supabase, driven by a person. |

| Category | Meaning |
|---|---|
| Happy path | The normal, intended outcome. |
| Negative | A request that must be refused, and what the user is told. |
| Boundary | An edge of a rule: a deadline, a cut-off, a capacity limit. |
| Security | Role, ownership and direct-write restrictions. |
| Concurrency | Two real sessions at once. |

Builds on US15 (`0043`) and US23 (`0050`). Capacity is `events.expected_attendance`.

## Design the tests assume

| # | Design | Source |
|---|---|---|
| D1 | Migration `0058_event_waiting_list.sql` adds `event_waitlist_entries` and the functions `join_waitlist`, `leave_waitlist`, `accept_waitlist_offer`, `list_my_waitlist`; it replaces `register_for_event` and `get_open_event`. `0043` and `0050` are untouched. | AC-016.1 |
| D2 | Capacity is `events.expected_attendance` and nothing else (team decision), so there is no second number to drift from venue suitability. Places left = capacity minus active registrations minus unexpired offers. | Team decision |
| D3 | Order is first come, first served by `joined_at`, ties broken by id. Position is computed, never stored. | AC-016.2 |
| D4 | A place opens when a registration is withdrawn (trigger, so `0050` is not edited), when capacity is raised, or when registration is switched back on. The first person waiting is offered it with 3 days to accept. | AC-016.3 |
| D5 | Expiry is lazy: there is no scheduler. Every join, leave, accept, registration and withdrawal first expires overdue offers and passes the place on, and the event page and My registrations (`0059`) do the same on every view. | AC-016.4 |
| D6 | A call that raises an error is rolled back as a whole, including any expiry it had just recorded. That is why `0059` makes accepting a lapsed offer return no registration instead of raising. | AC-016.4 |
| D7 | One advisory lock per event serialises every waiting-list path, taken after the registration or entry row and the event row, so two withdrawals or two registrations cannot deadlock or exceed capacity. | AC-016.1 |
| D8 | Error codes: `53000` event full, `55000` wrong state (hint says which), `23505` already registered or waitlisted (hint says which), `22000` registration not open, `42501` not an Attendee, `P0002` no such entry or not yours, `22023` invalid answers. | AC-016.1, .5 |
| D9 | Offers and expiries queue emails through the existing `notification_outbox` in the same transaction. Delivery was checked once by hand on 17 October. | AC-016.3 |
| D10 | Migration `0060_waitlist_coordinator_override.sql` orders the queue by a new `queue_key` that starts equal to `joined_at`, so first come, first served holds until someone is moved. `joined_at` is never changed. | SCRUM-154 |
| D11 | `move_waitlist_entry(entry, 'front' / 'up' / 'down')` is for the assigned Coordinator only, only while the event is Confirmed, and only for someone still waiting. It rewrites the keys of everyone waiting one microsecond apart, so a later joiner can never fall in front. The moved entry records who moved it and when (`overridden_by`, `overridden_at`). | SCRUM-154 |
| D12 | `list_event_waitlist(event)` shows the Coordinator names, positions and join times only, with held places first. It also clears overdue offers, so the list is never stale. | SCRUM-154 |
| D13 | Migration `0062_waitlist_expiry_job.sql` adds `process_overdue_waitlists()`, which runs the existing offer logic for every event that has a lapsed offer, and schedules it every minute as `expire-waitlist-offers` when `pg_cron` is installed. It adds no rule of its own. The test database has no `pg_cron`, so the tests call the function the schedule runs. | SCRUM-153 |

## Assumptions (to confirm with the team)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | No new offers are made in the 24 hours before an event starts (Thread 116 sets no rule; this is the team's to change). | .3.10 |
| A2 | An offer lasts 3 days or until the event starts, whichever is sooner, so one made 36 hours out lasts 36 hours. | .3.11 |
| A3 | While anyone is queued, a direct registration is refused even if a place is free, so nobody jumps the line. | .1.1, .2.3 |
| A4 | Leaving after being offered a place hands it straight to the next person. | .4.7 |
| A5 | The Coordinator override of list order (SCRUM-154) and VIP manual adds are not built; the team decided to leave them out. | none |
| A6 | With the timer on, a lapsed offer is passed on within about a minute. Without it, it is passed on at the next touch of the event. | .4.2, .4.20 |
| A7 | A moved attendee is not emailed, and the Coordinator cannot move someone who already holds an offered place. | .2.14 to .2.45 |
| A8 | The override covers moving one person at a time to the front or one place up or down, not choosing an exact position. | .2.15 to .2.17 |

## AC-016.1 When registration has reached the capacity, an attendee is offered the waiting list instead

| ID | Level | Category | Case | Result |
|---|---|---|---|---|
| AC-016.1.1 | Integration (SQL) | Negative | Registering for a full event is refused (53000) | Pass |
| AC-016.1.2 | Integration (SQL) | Happy path | Attendees join the waiting list of a full event | Pass |
| AC-016.1.3 | Integration (SQL) | Negative | An event that still has places refuses the waiting list (55000) | Pass |
| AC-016.1.4 | Integration (SQL) | Negative | An event with registration off, and one that is not Confirmed, refuse it (22000) | Pass |
| AC-016.1.5 | Integration (SQL) | Security | An Organiser and a visitor who is not signed in are refused (42501) | Pass |
| AC-016.1.6 | Integration (SQL) | Happy path | The event page reports a full event as full, and an event with places as not full | Pass |
| AC-016.1.7 | Integration (SQL) | Concurrency | Two simultaneous requests for the last place give it to one person; capacity is not exceeded | Pass |
| AC-016.1.8 | Integration (SQL) | Happy path | Once nobody is waiting, a free place goes back to ordinary registration | Pass |
| AC-016.1.9 | Unit | Happy path | The service sends only the event id to `join_waitlist` | Pass |
| AC-016.1.10 | Unit | Negative | A refusal says why and whether the page should reload (not full, closed, not an Attendee, other) | Pass |
| AC-016.1.11 | Unit | Happy path | The event page is told when the event is full | Pass |
| AC-016.1.12 | Unit | Negative | Registering for an event that filled meanwhile says to join the waiting list | Pass |
| AC-016.1.13 | Component | Happy path | A full event shows Join the waiting list and no registration form | Pass |
| AC-016.1.14 | Component | Happy path | Joining asks for this event and then reloads the page | Pass |
| AC-016.1.15 | Component | Happy path | An event with places shows the registration form, not the waiting list | Pass |
| AC-016.1.16 | Component | Negative | A registered attendee sees that, not the waiting list | Pass |
| AC-016.1.17 | Component | Happy path | My registrations lists the waiting lists the attendee is on | Pass |
| AC-016.1.18 | Component | Boundary | With no waiting lists there is no Waiting lists section | Pass |
| AC-016.1.19 | E2E (manual) | Happy path | See manual cases | Not run |

## AC-016.2 Waiting-list positions follow first-come-first-served order

| ID | Level | Category | Case | Result |
|---|---|---|---|---|
| AC-016.2.1 | Integration (SQL) | Happy path | Positions 1, 2 and 3 follow the order people joined | Pass |
| AC-016.2.2 | Integration (SQL) | Happy path | Only the first is offered a place; the next moves up to position 1 | Pass |
| AC-016.2.3 | Integration (SQL) | Negative | Someone not queued cannot take a held place by registering directly | Pass |
| AC-016.2.4 | Integration (SQL) | Happy path | A later joiner goes to the back of the line | Pass |
| AC-016.2.5 | Integration (SQL) | Happy path | When someone ahead leaves, the people behind move up; the entry is kept as left | Pass |
| AC-016.2.6 | Unit | Happy path | The service sends only the entry id to `leave_waitlist` | Pass |
| AC-016.2.7 | Unit | Negative | An entry already gone reloads the page; other failures can be retried | Pass |
| AC-016.2.8 | Unit | Happy path | The attendee's waiting lists are mapped, including the queue position | Pass |
| AC-016.2.9 | Unit | Negative | A failed load says so without the raw error | Pass |
| AC-016.2.10 | Unit | Happy path | The event page gets the attendee's position while they wait | Pass |
| AC-016.2.11 | Component | Happy path | Someone waiting sees their position and can leave | Pass |
| AC-016.2.12 | Component | Happy path | A waiting entry shows position, a link to the event, and Leave | Pass |
| AC-016.2.13 | E2E (manual) | Happy path | See manual cases | Not run |
| AC-016.2.14 | Integration (SQL) | Happy path | The assigned Coordinator sees the list in first-come-first-served order, with names only | Pass |
| AC-016.2.15 | Integration (SQL) | Happy path | Move to front puts that person first and keeps the rest in order | Pass |
| AC-016.2.16 | Integration (SQL) | Happy path | Move up swaps with the person directly ahead | Pass |
| AC-016.2.17 | Integration (SQL) | Happy path | Move down swaps with the person directly behind | Pass |
| AC-016.2.18 | Integration (SQL) | Boundary | Moving the first person up or to the front, or the last down, changes nothing and is not an error | Pass |
| AC-016.2.19 | Integration (SQL) | Happy path | Attendees see their new position after the Coordinator moves people | Pass |
| AC-016.2.20 | Integration (SQL) | Happy path | When each person actually joined is unchanged by the moves | Pass |
| AC-016.2.21 | Integration (SQL) | Happy path | Each moved entry records which Coordinator moved it and when; the others do not | Pass |
| AC-016.2.22 | Integration (SQL) | Security | A Coordinator not assigned to the event cannot reorder or read its list (42501) | Pass |
| AC-016.2.23 | Integration (SQL) | Security | A Coordinator Lead, an attendee, the Organiser and a visitor cannot reorder it (42501) | Pass |
| AC-016.2.24 | Integration (SQL) | Security | An unknown entry id is refused the same way, so ids cannot be probed | Pass |
| AC-016.2.25 | Integration (SQL) | Negative | A move other than front, up or down, or a missing one, is refused (22023) | Pass |
| AC-016.2.26 | Integration (SQL) | Negative | An event that is not Confirmed cannot have its list reordered (22000) | Pass |
| AC-016.2.27 | Integration (SQL) | Negative | None of the refused attempts changed the order | Pass |
| AC-016.2.28 | Unit | Boundary | The first person in line cannot go to the front or up, but can go down | Pass |
| AC-016.2.29 | Unit | Boundary | The last person cannot go down, but can go up or to the front | Pass |
| AC-016.2.30 | Unit | Happy path | Someone in the middle can make every move | Pass |
| AC-016.2.31 | Unit | Boundary | A person alone in the queue, or an unknown id, has nothing to move to | Pass |
| AC-016.2.32 | Unit | Happy path | The service maps the list the database returns, with names and positions | Pass |
| AC-016.2.33 | Unit | Negative | A refusal because they are not assigned says so; any other failure is generic | Pass |
| AC-016.2.34 | Unit | Happy path | A move sends only the entry and the direction | Pass |
| AC-016.2.35 | Unit | Negative | A person no longer waiting, or an event not Confirmed, reloads the list | Pass |
| AC-016.2.36 | Unit | Negative | A Coordinator who is not assigned, and any other failure, can be told and retried | Pass |
| AC-016.2.37 | Component | Happy path | The Coordinator's panel shows each person in order with their position | Pass |
| AC-016.2.38 | Component | Boundary | The first person cannot move to the front or up, and the last cannot move down | Pass |
| AC-016.2.39 | Component | Happy path | Clicking a move sends that entry and direction, then reloads the list | Pass |
| AC-016.2.40 | Component | Negative | If the list was out of date, the reason is shown and the list reloads | Pass |
| AC-016.2.41 | Component | Negative | A failure that can be retried is shown without reloading the list | Pass |
| AC-016.2.42 | Component | Boundary | A second click while a move is being saved sends nothing more | Pass |
| AC-016.2.43 | Component | Negative | An empty list says so, and a failed load is shown | Pass |
| AC-016.2.44 | Component | Happy path | The assigned Coordinator sees the Waiting list card on a Confirmed event | Pass |
| AC-016.2.45 | Component | Security | Nobody else sees it, and nobody sees it once the event is not Confirmed | Pass |
| AC-016.2.46 | E2E (manual) | Happy path | See manual cases | Not run |

## AC-016.3 When a place becomes available, the first person is notified and given 3 days to accept

| ID | Level | Category | Case | Result |
|---|---|---|---|---|
| AC-016.3.1 | Integration (SQL) | Happy path | A withdrawal offers the place to the first person waiting, with 3 days | Pass |
| AC-016.3.2 | Integration (SQL) | Happy path | They are emailed the offer with its deadline | Pass |
| AC-016.3.3 | Integration (SQL) | Happy path | Joining queues a confirmation email | Pass |
| AC-016.3.4 | Integration (SQL) | Negative | An invalid phone number is refused (22023) and the offer stays open | Pass |
| AC-016.3.5 | Integration (SQL) | Happy path | Accepting registers them with their answers and registrations stay at capacity | Pass |
| AC-016.3.6 | Integration (SQL) | Negative | Someone who has not been offered a place cannot accept one (55000) | Pass |
| AC-016.3.7 | Integration (SQL) | Security | Nobody can accept an offer made to someone else (P0002) | Pass |
| AC-016.3.8 | Integration (SQL) | Happy path | Raising the event's capacity offers the new place to the first waiting | Pass |
| AC-016.3.9 | Integration (SQL) | Boundary | No offer while registration is off; switching it back on makes the offer | Pass |
| AC-016.3.10 | Integration (SQL) | Boundary | No offer in the last 24 hours before the event starts | Pass |
| AC-016.3.11 | Integration (SQL) | Boundary | An offer never lasts past the event start | Pass |
| AC-016.3.12 | Unit | Happy path | The service sends the entry and the trimmed answers to `accept_waitlist_offer` | Pass |
| AC-016.3.13 | Unit | Negative | Invalid answers are refused before any request, with the fields to fix | Pass |
| AC-016.3.14 | Unit | Negative | The database's answer message is shown; a gone offer reloads the page | Pass |
| AC-016.3.15 | Unit | Happy path | The event page gets the deadline while a place is held | Pass |
| AC-016.3.16 | Unit | Happy path | An offer whose deadline is ahead can be accepted | Pass |
| AC-016.3.17 | Unit | Negative | Someone still waiting has nothing to accept | Pass |
| AC-016.3.18 | Component | Happy path | An open offer shows its deadline and the accept form | Pass |
| AC-016.3.19 | Component | Happy path | With an offer, the form says Accept place and accepts instead of registering | Pass |
| AC-016.3.20 | Component | Negative | A refused acceptance is shown and the answers are kept | Pass |
| AC-016.3.21 | Component | Happy path | Without an offer the same form still registers directly | Pass |
| AC-016.3.22 | Component | Happy path | My registrations shows an open offer and links to where it is accepted | Pass |
| AC-016.3.23 | E2E (manual) | Happy path | See manual cases | Not run |
| AC-016.3.24 | Integration (SQL) | Happy path | The place that opens goes to whoever the Coordinator moved to the front | Pass |
| AC-016.3.25 | Integration (SQL) | Happy path | A person who joins after the overrides goes to the back of the line | Pass |
| AC-016.3.26 | Integration (SQL) | Negative | Someone who already holds an offered place cannot be moved, and is listed apart from the queue (55000) | Pass |
| AC-016.3.27 | Unit | Boundary | Someone holding an offer cannot move and does not count as ahead of anyone | Pass |
| AC-016.3.28 | Component | Happy path | A held place is shown with its deadline and no move buttons | Pass |

## AC-016.4 If the offer is not accepted within 3 days, it passes to the next person

| ID | Level | Category | Case | Result |
|---|---|---|---|---|
| AC-016.4.1 | Integration (SQL) | Happy path | The next person on the list is offered the place that opened | Pass |
| AC-016.4.2 | Integration (SQL) | Boundary | Opening the event page after the deadline records the expiry and passes the place on | Pass |
| AC-016.4.3 | Integration (SQL) | Happy path | The person whose offer lapsed is emailed | Pass |
| AC-016.4.4 | Integration (SQL) | Happy path | The next person is emailed the offer | Pass |
| AC-016.4.5 | Integration (SQL) | Happy path | My registrations shows that their offer expired | Pass |
| AC-016.4.6 | Integration (SQL) | Boundary | Accepting after the deadline registers nothing and the expiry is kept, not rolled back | Pass |
| AC-016.4.7 | Integration (SQL) | Happy path | Leaving with an offer in hand passes the place to the next person | Pass |
| AC-016.4.8 | Unit | Negative | No registration and no error means the offer lapsed, so the page reloads | Pass |
| AC-016.4.9 | Unit | Boundary | An offer past its deadline cannot be accepted even if the page says offered | Pass |
| AC-016.4.10 | Unit | Boundary | The deadline is half-open: expiring exactly now has lapsed | Pass |
| AC-016.4.11 | Unit | Negative | An entry marked expired, or with no deadline, cannot be accepted | Pass |
| AC-016.4.12 | Component | Negative | A lapsed offer says so and offers the waiting list again | Pass |
| AC-016.4.13 | Component | Negative | An expired entry says so and has nothing to leave | Pass |
| AC-016.4.14 | Component | Boundary | An offer past its deadline that still reads offered is treated as expired | Pass |
| AC-016.4.15 | E2E (manual) | Boundary | See manual cases | Not run |
| AC-016.4.16 | Integration (SQL) | Boundary | Opening the Coordinator's list after the deadline clears the lapsed offer and passes the place on in the Coordinator's order | Pass |
| AC-016.4.17 | Unit | Negative | An offer that has expired cannot be moved either | Pass |
| AC-016.4.18 | Component | Negative | An expired offer is shown as expired, with no move buttons | Pass |
| AC-016.4.19 | Integration (SQL) | Boundary | With no offer past its deadline the expiry job does nothing and leaves open offers alone | Pass |
| AC-016.4.20 | Integration (SQL) | Happy path | The job expires a lapsed offer and offers the place to the next person, with a fresh 3 days | Pass |
| AC-016.4.21 | Integration (SQL) | Happy path | The job queues both emails: to the person who lost the place and to the next person | Pass |
| AC-016.4.22 | Integration (SQL) | Boundary | For an event with registration switched off, the lapsed offer is expired but nobody new is offered | Pass |
| AC-016.4.23 | Integration (SQL) | Boundary | Running the job again is safe: it finds nothing and sends no second email | Pass |
| AC-016.4.24 | Integration (SQL) | Security | An attendee and a visitor cannot call the job directly (42501) | Pass |
| AC-016.4.25 | E2E (manual) | Happy path | See manual cases | Not run |

## AC-016.5 An attendee cannot join the waiting list for an event they are registered or waitlisted for

| ID | Level | Category | Case | Result |
|---|---|---|---|---|
| AC-016.5.1 | Integration (SQL) | Negative | A registered attendee cannot join (23505); no entry is created | Pass |
| AC-016.5.2 | Integration (SQL) | Negative | An attendee already on the list cannot join again; still one entry | Pass |
| AC-016.5.3 | Integration (SQL) | Negative | And cannot register directly while waitlisted | Pass |
| AC-016.5.4 | Integration (SQL) | Boundary | The database itself refuses a second active entry, whatever calls it | Pass |
| AC-016.5.5 | Integration (SQL) | Concurrency | Two simultaneous joins by one attendee create one entry | Pass |
| AC-016.5.6 | Integration (SQL) | Security | An attendee reads only their own entries | Pass |
| AC-016.5.7 | Integration (SQL) | Security | Attendees cannot insert, update or delete entries directly | Pass |
| AC-016.5.8 | Unit | Negative | Registered, already waiting, and the index's own error each get the right message | Pass |
| AC-016.5.9 | Unit | Negative | A waitlisted attendee registering is told they are already on the list | Pass |
| AC-016.5.10 | Component | Negative | If the list changed since the page loaded, the reason is shown and the page reloads | Pass |
| AC-016.5.11 | Component | Boundary | A second click while joining is ignored | Pass |
| AC-016.5.12 | E2E (manual) | Negative | See manual cases | Not run |

## Manual cases (against the shared Supabase, signed in as real accounts)

Prerequisite: `0058` and `0059` applied. Use a Confirmed event with registration enabled, starting more
than 24 hours ahead, and set its `expected_attendance` to 1 in the SQL editor. Use three Attendee accounts.

| ID | Steps | Expected | Result |
|---|---|---|---|
| AC-016.1.19 | Attendee 1 registers for the event. Attendee 2 opens it. | Attendee 2 sees "This event is full" and Join the waiting list, no registration form. After joining, the page shows their position. | Not run |
| AC-016.2.13 | Attendee 2 then Attendee 3 join. Open the event as each. | Attendee 2 is at position 1 and Attendee 3 at position 2. My registrations lists both under Waiting lists. | Not run |
| AC-016.3.23 | Attendee 1 withdraws under My registrations. Open the event as Attendee 2, fill in the form and click Accept place. | Attendee 2 sees the deadline and the accept form, and is then registered. Attendee 3 is still waiting. A queued email row exists for the offer. | Not run |
| AC-016.4.15 | With a new offer made to Attendee 3, set its `offer_expires_at` to a past time in the SQL editor, then open the event as Attendee 3. | The page no longer shows the offer and says it expired. My registrations shows the expired entry. | Not run |
| AC-016.5.12 | As an attendee already on the list, open the event page in two tabs and click Join in both. | The second attempt is refused with the "already on the waiting list" message, and there is one entry. | Not run |
| AC-016.4.25 | After `0062` is applied, check the schedule exists: `select jobname, schedule, active from cron.job;`. Make an offer, then in the SQL editor set its `offer_expires_at` to a past time and wait two minutes without opening the event. | One row `expire-waitlist-offers` with `* * * * *`, active. Within about two minutes the lapsed offer is `expired`, the next person is `offered`, and two rows are queued in `notification_outbox`. | Not run |
| AC-016.2.46 | Assign the event to the Coordinator account. With Attendees 2 and 3 on the waiting list, open the request as the Coordinator, find the Waiting list card and click Move to front on Attendee 3. Then open the event as each attendee. | The card lists them in order and the first person's front and up buttons are disabled. After the move Attendee 3 is at position 1 and Attendee 2 at position 2. When a place opens, Attendee 3 is the one offered it. | Not run |

Email delivery is not checked here, as for US4, US7, US14, US15 and US23: only that rows reach
`notification_outbox`.

## Other changes in this story

| Change | Where |
|---|---|
| Two existing fixtures gained the new `full` and `waitlist` fields; their IDs and assertions are unchanged. | `OpenEventDetailsPage.test.tsx`, `registrationService.test.ts` |
| The existing My registrations test now mocks the waiting-list loader, so it makes no real network call. | `MyRegistrationsPage.test.tsx` |
| `waiting_list.sql` uses the fixture id prefix `16`, which no other file uses. | tests |

Next unused IDs: `AC-016.1.20`, `.2.47`, `.3.29`, `.4.26`, `.5.13`.
