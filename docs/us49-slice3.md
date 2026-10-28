# US49 Slice 3: individual venue cancellation

Branch `us49/slice3-booking-cancellation`, based on main `f1584f2`.
Reserved migration **0110**; criteria **AC-049.7–9** and the agreed rejected-booking
recovery from Slice 2. Code-first implementation with AC-tagged tests.

## Delivered behaviour

The assigned Coordinator opens **Your venue bookings**, selects **Cancel booking**,
enters a reason and confirms. Pending, approved and rejected bookings are supported.
The confirmation shows the current booking status. Tentative holds keep their
existing release action; pending requests now require the audited cancellation.

The database checks assignment and the loaded booking version after taking venue,
event and booking locks. It records the previous status, trimmed reason, actual
actor/name and server time in `venue_booking_cancellations`. Original review notes,
alternatives and decision records remain intact. Direct browser cancellation cannot
bypass the checked action. A retry/stale version is refused; the UI preserves the
reason and requires reload before another attempt.

Cancellation releases only that booking's event/setup/turnaround claims. Other
bookings and every event column are preserved, including when the final booking is
cancelled. It does not automatically cancel or demote the event. Existing closure
and booking-end triggers retain their cleanup behaviour.

Venue Staff receive `venue_booking_cancelled` notices through US33's existing
in-app/email helpers and preferences. Email is queued, not claimed delivered.
The Coordinator sees cancellation history on the booking, in Singapore time.
An error creating a notice rolls the entire cancellation transaction back.

## Readiness and deployment

0107 was applied to shared Supabase, as confirmed by Justas. It is unchanged.
Main now includes 0108's shared `event_readiness_lines()` with the rejected-booking
rule and its feature switch, plus 0109/0111. **0110 changes neither readiness
function nor the safety switch.** Cancelling a rejected requirement lets the
existing helper count only the remaining required bookings.

No automatic pairing is inferred between a rejected booking and an independently
approved replacement: the Coordinator explicitly cancels the unwanted requirement.
Safety-stage re-review after an arrangement changes remains the US45 integration;
this slice does not silently change an event's status or invalidate safety decisions.

0110 depends on existing venue and notification infrastructure through 0107; it
does not depend on 0111/0112. Coordinate its application with the team, deploy the
cancellation UI, and verify the rejected-booking recovery before enabling the
US43 safety workflow. Do not enable its switch as part of applying this migration.

Optional read-only impact count before deployment:

```sql
select count(*) as rejected_bookings, count(distinct event_id) as affected_events
from public.venue_bookings where status = 'rejected';
```

This query has not been run against shared Supabase. No shared data is changed by
the local tests, and no historical rejection is automatically cleared.

## Validation and evidence

Evidence folder: `docs/test-evidence/us49-slice3/`.
Final full coverage run: **194 files / 1,595 tests passed**. Typecheck, lint and
production build passed. Historical, current-schema upgrade and fresh-schema
database suites all exited 0. The current suites run 16 cancellation assertions
before/after replay plus the real concurrency case (33 PASS entries).

Overall coverage: 96.28% lines/statements, 91.07% branches, 95.39% functions.
Both new production files have 100% line/statement/function coverage; branch
coverage is 92.3% for the service and 93.93% for the panel. This is not a claim
of 100% branch coverage. Extract `coverage-report.zip` and open `index.html`.

Database tests: `individual_venue_cancellation.sql` (run again after replay) and
`individual_venue_cancellation_races.sh` (real concurrent approval/cancellation).
Coverage includes blank reasons, stale consent, role enforcement, blocked direct
writes, sibling preservation, slot release, last-booking cancellation, rejected
history/readiness recovery, audit uniqueness, notification preferences and full
rollback following an injected downstream failure.

Frontend tests: `VenueCancellationPanel.test.tsx`, `venueCancellationService.test.ts`
and the updated pending/rejected booking cases in `VenueBookingPages.test.tsx`.
The older pending-request test initially expected **Release hold**. Its expectation
was updated to assert the new reason-required cancellation contract (US9/US49),
while tentative-hold release tests remain unchanged.

`AC-049.7.33-forced-break.log`: temporarily sent the wrong expected version; the
payload assertion failed, then the original source was restored before the final
full coverage run. This is code-first test verification, not TDD red evidence.
PostgreSQL coverage is not measured by Vitest; database assertions and race/replay
checks provide that evidence. Expected concurrent losers can print SQL errors.

## Manual showcase after deployment

1. Coordinator: open an event with two bookings. Cancel one pending booking with a
   reason. Verify its status/history and that the sibling and event are unchanged.
2. Repeat for an approved booking with setup/turnaround. Check availability shows
   its cells released, while unrelated bookings/closures remain protected.
3. On an event with an approved booking and a rejected requirement, cancel the
   rejected one. Confirm the rejection note is retained and venue readiness clears
   if every remaining required booking is approved.
4. Venue Staff: check the cancellation notification and reason. Test channel
   preferences separately; an outbox row is not evidence of actual email delivery.
5. Open the same pending booking twice. Decide it in one session; cancellation
   from the stale session must be refused until reloaded.
6. Cancel the only booking: the event remains present and its status unchanged;
   venue readiness becomes outstanding because no venue remains approved.

Review owners: US9/US11 (pending release now requires a reason), US10 (decision
concurrency), US33 (new notification type), US43/US44/US45 (safety-stage integration).
US5's shared readiness helper is retained. Original migrations are not edited.

No commit, push, PR, shared migration application or manual-browser pass is claimed.
