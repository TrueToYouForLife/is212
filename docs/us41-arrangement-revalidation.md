# US41 — Review arrangements after significant changes

Owner: Jaydon

Status: backend increment implemented locally. UI, manual verification, CI and PR
review remain. Migration 0052 is claimed but has not been applied to shared Supabase
as part of this work. This is code-first development, not TDD.

## Scope and behavior

Migration `0052_arrangement_revalidation.sql` consumes the US7 accepted-field hook
in the same approval transaction. Only approved significant fields are considered.
An ordinary edit or a rejected significant field does not create arrangement flags.
There is no backfill of historical approvals.

Each `arrangement_review_flags` record links an event, change request, one venue
booking or equipment reservation, and a stable reason code with readable detail.
Several reasons can coexist for the same arrangement. Open records will be shown
as **Needs review** in the forthcoming UI; they do not replace booking status.
Bookings, slot claims and equipment allocations are never moved or cancelled by
this migration, including when a flag is resolved.

- Timing: check each live venue booking against the new event window, existing
  occupied cells and active closures. A free new window still requires review if
  the existing reserved cells do not match it. Pending/confirmed bookings and
  unexpired holds are considered; cancelled/rejected/expired bookings are excluded.
- Equipment timing: check the actual reserved or checked-out units against the
  new dates using the existing availability function and collection rules. Preserve
  each allocation's agreed return extension. A change of reservation dates also
  receives a review reason even when no conflicting allocation exists.
- Attendance: compare each venue's capacity for the requested layout. Equality is
  suitable. Unknown layout capacity requires manual review, not a claim that the
  venue is too small. This uses the existing event-level requirements model.
- Layout, accessibility and equipment requirement changes: store a reusable manual
  review explanation. Free-text requirements cannot prove incompatibility, so the
  messages do not claim a shortage or accessibility failure automatically.
- Notifications: one protected database notice per new reason, addressed to the
  currently assigned coordinator and linked to the arrangement through its flag.
  No email delivery or visible in-app notification panel is added in this increment.
- Resolution: `resolve_arrangement_review` accepts `corrected` or `confirmed_valid`
  with a mandatory explanation. Only the current assigned coordinator can call it.
  It records actor/time/method/note and refuses a second resolution. It records the
  coordinator's review; it does not itself correct or rebook the arrangement.

The existing `event_change_revalidations.status` remains unchanged for compatibility;
`checked_at` records execution of these checks. It is not a claim that all reviews
are resolved. New code must use open flags when deciding whether review is pending.

## Existing timing dependency

Venue timing uses the shared `venue_review_cells` function and current slot ledger.
Those currently represent AM/PM/Night cells. US41 does not independently implement
the Week 7 fifteen-minute booking change; it must remain aligned with the shared
booking implementation when that work lands. Equipment reservations remain date-based.

## Automated cases

File: `backend/supabase/tests/arrangement_revalidation.sql`, with replay verification
in `backend/supabase/tests/run_change_request_review.sh`.

All cases are database integration tests using disposable PostgreSQL, actual review
RPCs, triggers and row-level security. They are automated, not manual SQL checks.

- AC-041.5.1 — Negative: ordinary approvals, rejected significant changes and pending
  proposals create no arrangement flags.
- AC-041.3.1 — Boundary: attendance equal to layout capacity remains suitable.
- AC-041.3.2 — Happy/negative: increased attendance flags only the smaller of two
  venues, with attendance and capacity in the explanation.
- AC-041.2.1 — Happy/negative: changed timing checks both venues and reserved equipment;
  distinguishes real conflicts from a free window that has not been reserved.
- AC-041.1.1 — Happy: requirement changes retain independent reasons and earlier flags.
- AC-041.4.1 — Happy: each new reason has one coordinator notice and arrangement reference.
- AC-041.6.1 — Happy/negative: current-coordinator-only access and resolution, mandatory
  note, both resolution methods and refusal to overwrite recorded history.
- AC-041.1.2 — Regression: approval and resolution leave all booking/claim/allocation
  records unchanged, checked against snapshots in both directions.
- AC-041.1.4 — Negative: a simulated notification-write failure rolls back event changes,
  the approval, queue record and flags together.
- AC-041.1.3 — Regression: replaying migration 0052 preserves existing flags and notices.

## Verification

13 October 2026: complete local disposable database runner passed (exit 0), including
all ten new US41 cases and the existing database regression/concurrency tests.
The first new-test run exposed a missing `reserved_by` in the test fixture; the
fixture was corrected. No frontend code changed or frontend verification is claimed.

Forced-break evidence, visible UI tests and Jaydon's manual checks remain pending.
A simulated write failure is a negative test; it is not a TDD red run or a separate
forced-break demonstration. GitHub Actions evidence will be available after Jaydon
pushes. Automated run records do not need duplicating in the spreadsheet run tab.

## Remaining work before completing US41

- Service and UI showing each affected arrangement, Needs review badge, all reasons
  and coordinator notices, with links to the relevant arrangement.
- Resolution controls and retained history, including loading, errors and refresh.
- Focused UI coverage and a code-first forced-break/restored-pass evidence check.
- Manual end-to-end checks, evidence-sheet updates and PR review.
- Apply 0052 through the team's migration process only when ready for shared testing.

Jaydon handles commits, pushes, PRs, deployment and Jira updates.
