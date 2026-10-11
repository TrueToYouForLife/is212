# US23 Withdraw a Registration as Attendee (SCRUM-68): test cases

Status: **implemented; all 34 automated cases pass (11 October).** 13 app tests (Vitest) and the 21 SQL
cases in `withdraw_registration.sql`, run in a disposable Docker database through
`bash backend/supabase/tests/run_change_request_review.sh` (the whole suite, 523 passing checks, no
failures). The full app suite is 888 passing. AC-023.4.3 stays a manual check until US54.
`0050` is **not applied to shared Supabase** and nothing is committed yet. Code was written before
the tests, at the team's request.

Test IDs follow `CLAUDE.md`: `AC-023.Y.Z`, where Y is the acceptance criterion in Jira order and Z
numbers the tests within it. Z is unique across the story and increases top to bottom within each
test file.

Builds on US15 (`0043_event_registrations.sql`): the table already allows `status = 'withdrawn'`
with a matching `withdrawn_at`, and the one-active-registration index is partial, so a withdrawn
row does not block registering again.

## Design the tests assume

| # | Design | Source |
|---|---|---|
| D1 | New migration `0050_withdraw_registration.sql` (0044/0045 are unused; 0046-0049 are on main). Safe to re-run. Not applied to shared Supabase until the team agrees. | Numbering |
| D2 | Withdrawal happens only through `withdraw_registration(p_registration_id uuid)`. It is SECURITY DEFINER with `search_path = ''`, and the caller is always `auth.uid()`. Browsers keep having no insert, update or delete on `event_registrations`. | AC-023.5; US15 D5 |
| D3 | Error codes, so the app can say something specific: `42501` caller is not an Attendee, `P0002` no such registration **or it is not yours** (one code, so a stranger's ID reveals nothing), `55000` already withdrawn, `22000` the event has started or is not Confirmed. | AC-023.1, .5 |
| D4 | Allowed only while the event is `confirmed` and `proposed_start > now()`. The rule reads the **current** start, so an event that was postponed or rescheduled to a later time can still be withdrawn from, with no special case. | AC-023.1 |
| D5 | The registration row is locked (`FOR UPDATE`) and updated `where status = 'registered'`, so two simultaneous withdrawals cannot both succeed. | AC-023.5 |
| D6 | The row is **kept**: `status = 'withdrawn'`, `withdrawn_at = now()`, answers untouched. It is never deleted, because US54's list must be able to show it as withdrawn. | AC-023.4 |
| D7 | Confirmation before: the UI asks first (names the event, "Withdraw" / "Keep my registration"). Confirmation after: an AFTER UPDATE trigger queues a plain-text email in `notification_outbox` in the same transaction, sent by the existing `send-review-notifications` function (the mechanism of 0043). If queueing fails, the withdrawal rolls back. | AC-023.2 |
| D8 | "Counts toward capacity": there is **no capacity limit or waiting list yet** (US16 is not built). The rule that exists is "active registration = `status = 'registered'`", used by the unique index and by US54's count. Withdrawal removes the row from that set and frees the person to register again. Releasing a place to a waiting list (SCRUM-210) belongs to US16. | AC-023.3 |
| D9 | The UI action sits on My registrations (`/registrations`). A pure `canWithdraw(registration, now)` in `validation.ts` decides whether the button shows; the database re-checks (defence in depth). | CLAUDE.md |

## Assumptions (to confirm with the team)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | Cancelled and completed events cannot be withdrawn from; there is nothing left to free. | .1.4, .1.8 |
| A2 | An event starting exactly now counts as started (half-open rule: `start <= now()` is refused). | .1.3, .1.7 |
| A3 | AC-023.4's "updated registration list" for Organiser and Coordinator **is US54 (SCRUM-246), not yet built**. US23 delivers the data they will read (D6). The view itself is a manual check once US54 exists, and no test claims it today. | .4.3 |
| A4 | The email is plain text: event name, start in Singapore time, and a pointer to My registrations. Real delivery is checked manually, as for US4/US7/US14/US15. | .2.6 |

## Fixtures (database tests, disposable Docker database only)

The SQL file has its own fixtures (ids start `23`), so no US15 state is assumed: `A1`-`A4` attendees,
`O1`, `C1`, `M1`, `V1`, `T1` other roles. Events and registrations:

| Fixture | Definition |
|---|---|
| `R-A1` | `A1`'s active registration for `E-OPEN` |
| `R-A2` | `A2`'s active registration for `E-OPEN` |
| `E-MOVED` | Confirmed event, registered, then `proposed_start` moved from 2035-03 to 2035-06 (rescheduled) |
| `E-STARTED` | Confirmed, `A1` registered, then start moved to one minute ago |

App tests (Vitest) mock Supabase, as the existing tests do.

## Planned test files

| Layer | File |
|---|---|
| SQL | `backend/supabase/tests/withdraw_registration.sql` (runner, straight after `event_registrations.sql`; the concurrency case uses `dblink` like AC-015.5.4) |
| Vitest | `frontend/src/features/registrations/__tests__/validation.test.ts` and `registrationService.test.ts` (extended), `WithdrawRegistrationButton.test.tsx` (new), `MyRegistrationsPage.test.tsx` (extended) |

---

## AC-023.1: Attendee can withdraw their own registration for an event that has not started, including after postponement or rescheduling

| Test ID | Layer | Scenario | Steps | Expected result |
|---|---|---|---|---|
| AC-023.1.1 | SQL | Own active registration for a future event | As `A1`, `withdraw_registration(R-A1)` | Row is `withdrawn` with `withdrawn_at` set |
| AC-023.1.2 | SQL | Boundary: event rescheduled to a later start | As `A1`, withdraw from `E-MOVED` | Succeeds |
| AC-023.1.3 | SQL | Boundary: event started one minute ago | As `A1`, withdraw from `E-STARTED` | Refused `22000`; still `registered` |
| AC-023.1.4 | SQL | Cancelled and completed events | As `A1`, withdraw from each | Refused `22000`; rows unchanged |
| AC-023.1.5 | SQL | Only the one row changes | Withdraw `R-A1` | `R-A2` still `registered`; nothing deleted |
| AC-023.1.6 | Vitest | `canWithdraw` for an active registration on a future Confirmed event | pure function | true |
| AC-023.1.7 | Vitest | Boundary: start equals now, and start in the past | pure function | false |
| AC-023.1.8 | Vitest | Already withdrawn, cancelled and completed | pure function | false |
| AC-023.1.9 | Vitest | Service sends only the registration id | `withdrawRegistration(id)` with mocked `rpc` | Calls `withdraw_registration` with `p_registration_id` only; returns ok |
| AC-023.1.10 | Vitest | Page shows Withdraw only where allowed | Render with four registrations | Button on the future active one only |

## AC-023.2: Attendee confirms before withdrawal takes effect and receives confirmation once it succeeds

| Test ID | Layer | Scenario | Steps | Expected result |
|---|---|---|---|---|
| AC-023.2.1 | Vitest | Click Withdraw asks first | Click Withdraw | Dialog names the event; service not called |
| AC-023.2.2 | Vitest | Backing out | Click "Keep my registration" | Dialog closes; service not called; still Registered |
| AC-023.2.3 | Vitest | Confirming | Click confirm | Service called once; "Your registration for <event> has been withdrawn."; row shows Withdrawn |
| AC-023.2.4 | Vitest | Failure: the withdrawal fails | Mock failure, confirm | Error shown; row still Registered; Withdraw available to retry |
| AC-023.2.5 | Vitest | Boundary: double click on confirm | Click confirm twice quickly | One service call (button disabled while pending) |
| AC-023.2.6 | SQL | Confirmation email queued | Withdraw `R-A1` | One `notification_outbox` row to `A1`'s address naming the event, start in Singapore time |
| AC-023.2.7 | SQL | Refused withdrawals queue nothing | Withdraw from `E-STARTED`; withdraw a stranger's id | No new outbox rows |
| AC-023.2.8 | SQL | Failure: email cannot be queued | Same technique as AC-015.3.4 | Withdrawal refused and rolled back; row still `registered` |

## AC-023.3: A withdrawn registration no longer counts and the place becomes available

| Test ID | Layer | Scenario | Steps | Expected result |
|---|---|---|---|---|
| AC-023.3.1 | SQL | Active count drops | Count `registered` rows for `E-OPEN`, withdraw `R-A1`, count again | One fewer |
| AC-023.3.2 | SQL | The same person can register again | `A1` calls `register_for_event(E-OPEN)` after withdrawing | Succeeds; one withdrawn row and one active row |
| AC-023.3.3 | SQL | Open-event list reflects it | `A1` calls `list_open_events` | `E-OPEN` shows `registered = false` |
| AC-023.3.4 | SQL | Boundary: withdrawing twice does not subtract twice | Withdraw `R-A1` again | Refused `55000`; active count unchanged |
| AC-023.3.5 | Vitest | My registrations marks it | Reload after withdrawal | "Registration: Withdrawn"; no Withdraw button |

## AC-023.4: Organiser and Coordinator see the updated registration list

| Test ID | Layer | Scenario | Steps | Expected result |
|---|---|---|---|---|
| AC-023.4.1 | SQL | The row is retained as withdrawn | Withdraw `R-A1` | Same id, `withdrawn`, `withdrawn_at` = transaction time, phone and answers unchanged |
| AC-023.4.2 | SQL | The event itself is untouched | Withdraw `R-A1` | `E-OPEN` status and start unchanged |
| AC-023.4.3 | Manual | Organiser and Coordinator views | Withdraw, open the registrations list | Withdrawn row marked and not counted. **Pending US54**; no pass claimed until then |

## AC-023.5: An Attendee cannot withdraw another person's registration, or one already withdrawn

| Test ID | Layer | Scenario | Steps | Expected result |
|---|---|---|---|---|
| AC-023.5.1 | SQL | Permission denied: someone else's registration | As `A2`, withdraw `R-A1` | Refused `P0002`; `R-A1` still `registered` |
| AC-023.5.2 | SQL | Unknown id looks the same | As `A1`, withdraw a random uuid | Refused `P0002`, identical to .5.1 |
| AC-023.5.3 | SQL | Already withdrawn | Withdraw `R-A1` twice | Second refused `55000`; `withdrawn_at` unchanged |
| AC-023.5.4 | SQL | Permission denied: other roles (one row each) | As `O1`, `C1`, `M1`, `V1`, `T1`, withdraw `R-A1` | Refused `42501`; row unchanged |
| AC-023.5.5 | SQL | Not signed in | As anon, call the function | Permission denied |
| AC-023.5.6 | SQL | No direct writes | As `A1`, `update`/`delete` on `event_registrations` | Permission denied; row unchanged |
| AC-023.5.7 | SQL | Concurrency: two simultaneous withdrawals | Race two sessions with `dblink` | Exactly one succeeds, the other `55000`; one email only |
| AC-023.5.8 | Vitest | Service turns codes into sentences | Mock `42501`, `P0002`, `55000`, `22000`, other | A distinct, readable message for each |
| AC-023.5.9 | Vitest | Already withdrawn elsewhere | Mock `55000` on confirm | Message shown and the list reloads to show Withdrawn |

**35 cases:** 21 SQL, 13 Vitest, 1 manual (pending US54). Next IDs: AC-023.1.11, .2.9, .3.6,
.4.4, .5.10.
