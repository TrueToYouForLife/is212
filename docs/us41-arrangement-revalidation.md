# US41 — Review arrangements after significant changes

Owner: Jaydon

Status: backend PR merged and migration 0052 applied to shared Supabase, confirmed
by Jaydon. Read-only flag display is implemented locally; verification and review
are tracked below. Notification display and resolution controls remain separate
increments. This is code-first development, not TDD.

## Scope and behavior

Migration `0052_arrangement_revalidation.sql` consumes the US7 accepted-field hook
in the same approval transaction. Only approved significant fields are considered.
An ordinary edit or a rejected significant field does not create arrangement flags.
There is no backfill of historical approvals.

Each `arrangement_review_flags` record links an event, change request, one venue
booking or equipment reservation, and a stable reason code with readable detail.
Several reasons can coexist for the same arrangement. Open records are shown
as **Needs review** in the read-only UI; they do not replace booking status.
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

At the backend checkpoint, forced-break evidence, visible UI tests and Jaydon's
manual checks remained pending. The read-only increment below updates that status.
A simulated write failure is a negative test; it is not a TDD red run or a separate
forced-break demonstration. GitHub Actions evidence will be available after Jaydon
pushes. Automated run records do not need duplicating in the spreadsheet run tab.

## Remaining work before completing US41

- Finish verification and review of the read-only arrangement display.
- Add coordinator notification display and appropriate arrangement navigation.
- Resolution controls and retained history, including loading, errors and refresh.
- Focused UI coverage and a code-first forced-break/restored-pass evidence check.
- Manual end-to-end checks, evidence-sheet updates and PR review.
- Apply 0052 through the team's migration process only when ready for shared testing.

Jaydon handles commits, pushes, PRs, deployment and Jira updates.

## Read-only review display increment

The assigned coordinator's event detail page now shows **Arrangement reviews**.
Open reasons are grouped by venue booking or equipment reservation, with one
Needs review badge per arrangement, full booking reference, reason text and
Singapore timestamps. Venue names are shown when accessible; the booking reference
remains available if the related venue cannot be read. Resolved flags are excluded.
An empty result means no current flags, not a guarantee of arrangement suitability.

Reads are scoped to the event and open status, with database RLS enforcing assignment.
The page mounts this section only for its current assigned coordinator. It refreshes
on page focus, every 30 seconds, after a review decision, and using either the page
refresh or the section's refresh button. Errors display a retryable message rather
than a misleading empty result. No write operations, resolution controls or notification
inbox are included. No additional migration is needed.

Five new automated cases (code-first):
- AC-041.1.5 — Service unit, happy/boundary: event/open filtering, stable ordering,
  related venue mapping, retained reasons and empty results.
- AC-041.1.6 — Service unit, negative: invalid ID, database failure, malformed response
  and thrown connection error are not treated as an empty list.
- AC-041.1.7 — Component, happy: multiple reasons grouped once per arrangement,
  equipment/venue references, Singapore dates and refresh after approval.
- AC-041.1.8 — Component, negative/boundary: loading, failed read, retry, inaccessible
  venue-name fallback and changing events without retaining old reasons.
- AC-041.1.9 — Page integration, happy/negative: only assigned coordinator sees the
  section and page refresh reloads it. Browser tests mock services; SQL tests cover RLS.

Manual checks for Jaydon (pending):
1. Sign in as the assigned coordinator and open an event with open US41 flags.
   Confirm each arrangement appears once and every reason is visible.
2. Check a flagged venue and equipment reservation against their stored references.
3. Approve a significant change that generates a flag; confirm the section refreshes
   without navigating away. Existing booking status must remain unchanged.
4. Open an event without flags; confirm the empty message. View the same flagged event
   as another coordinator or an organiser; the section must not appear.
5. Simulate an offline read and refresh: an error should appear. Restore the connection
   and refresh again to recover the reasons.

UI notification display and resolution/history controls remain outstanding. Do not
mark the whole US41 complete after this read-only increment.

### Read-only increment verification — 13 October 2026

- Full frontend suite passed: 108 files, 997 tests passed, one existing TODO.
- Lint and production build passed. The existing large-bundle warning remains.
- Initial module reads timed out before verification could run; `npm ci` restored
  the locked dependencies and the rerun completed. No dependency versions changed.
- Forced-break AC-041.1.7: temporarily kept only the last reason in each group. The
  unchanged test failed because the attendance reason disappeared. Restoring the
  component byte-for-byte made the same test pass. Only the selected case ran;
  the other case was skipped in these two logs. This is test-sensitivity evidence,
  not a real product defect or TDD cycle. Logs:
  [expected failure](test-evidence/us41/AC-041.1.7-forced-break.log) and
  [restored pass](test-evidence/us41/AC-041.1.7-restored-pass.log).
- No database code changed in this UI increment. No new deployment is required.
- Jaydon's browser checks, GitHub CI and PR review are pending.

### Manual defect — arrangement section hidden

Discovered by: Jaydon. Fixed by: Jaydon. Date: 13 October 2026.
The event detail query omitted coordinator_id, so the assigned-coordinator display
condition received undefined and hid the entire section. Page mocks included the
field and did not expose the missing query column. Added coordinator_id to the
actual detail projection. Regression AC-041.1.10 models selected columns only and
checks both assigned and unassigned mapping; it failed before the fix and passed
afterwards. All 30 tests across the four relevant service/page/panel files passed.
This is a genuine manually reported defect, separate from the deliberate forced-break
check. Jaydon's browser retest remains pending. There are now six new UI/service
cases for this increment. No migration change is required.

### Review indicators on request cards and event status

The assigned coordinator's Requests cards now show **Needs review · N arrangements**
next to the unchanged event status. A single open-flag query supplies counts for
all cards; database RLS limits the rows. Counts deduplicate venue bookings and
equipment reservations, so three reasons on one booking count as one arrangement.
Other coordinators' cards and non-coordinator views do not show the indicator.
Failed count reads show an explicit warning rather than implying no flags exist.

Below Current status, the assigned coordinator sees a matching count and a link to
`#arrangement-reviews`. This uses the detailed panel's loaded data, with no additional
query; empty/error/loading data removes the notice. Refreshing the page or review
section updates both. This is an arrangement indicator, not a notification inbox
or an event-status change. No database migration is required.

Additional cases:
- AC-041.1.11 — Service unit, happy/negative: distinct per-event counts from one
  open-flag query, plus failure handling.
- AC-041.1.12 — Page integration, happy/negative: assigned-only badges, unchanged
  event status, failed read, retry, singular/plural counts and no organiser query.
- Existing .1.7 and .1.9 also check the detail count and anchor, including removal
  when no arrangements remain. Eight new UI/service cases now cover this increment.

Manual retest pending: check Requests as the assigned coordinator, open a flagged
event and click the notice below Current status to reach the reasons. Confirm that
a booking with several reasons contributes only one to the displayed count.

Final indicator verification, 13 October 2026: full frontend suite passed, 109 files,
1,000 passing tests and one existing TODO. Lint and production build passed.
Browser retest by Jaydon remains pending.
