# US41 — Review arrangements after significant changes

Owner: Jaydon

Status: AC3 follow-up fix pending review and deployment (migration 0053). Original implementation merged in PRs #86, #87 and #88. Migration 0052 applied to
shared Supabase, confirmed by Jaydon. The original implementation covers the agreed
US41 responsibility: flag affected arrangements, record coordinator notifications,
display reasons and allow recorded resolution. Shared notification UI and email
delivery are owned elsewhere and are not claimed as delivered by US41.

Close-out review: 13 October 2026, against SCRUM-237 (1).doc and merged code at
3e90307. This documentation change still needs its own PR; Jaydon handles Git/Jira.

## Acceptance criteria review

- **AC-041.1 — Flag affected arrangements without changing reservations:** implemented
  in 0052 and the arrangement review UI. Each reason links its change request and
  venue booking or equipment reservation. Several reasons may belong to one
  arrangement; badges count distinct arrangements. Snapshot tests verify that
  approval and resolution do not mutate bookings, claims or equipment allocations.
- **AC-041.2 — Recheck timing:** each live venue booking is checked against the updated
  event window, occupied cells and active closures. Actual reserved equipment units
  are checked using existing collection/return availability rules. A free new interval
  that differs from reserved dates receives a review reason, not a false conflict.
- **AC-041.3 — Recheck layout capacity:** attendance is compared with each venue's
  capacity for the requested layout. Equality remains suitable; unknown layout
  capacity requests manual review rather than falsely reporting insufficient space.
- **AC-041.4 — Notify coordinator:** the agreed US41 producer responsibility is complete.
  One protected database notification is created per new reason, addressed to the
  assigned coordinator and linked to the arrangement. This is not an end-to-end
  notification-delivery claim. Shared UI/email integration remains a dependency;
  record this ownership boundary in Jira when closing the story.
- **AC-041.5 — Ordinary edits:** US7's accepted-field hook excludes ordinary edits,
  rejected significant fields and provisional decisions awaiting clarification.
- **AC-041.6 — Resolve flags:** only the current assigned coordinator may record
  Arrangement corrected or Still valid with a mandatory explanation. Other open
  reasons remain flagged. History retains the method, note, actor and timestamp.
  Correction is performed through the existing booking workflow, then recorded here;
  saving a resolution does not itself rebook, cancel or edit an arrangement.

## Notification handoff contract

Existing source: `public.arrangement_review_notifications`, created by 0052.
No new schema, notification interface or email sender was added during close-out.

- `id`: stable notification identifier.
- `recipient_id`: coordinator assigned when the reason was generated.
- `event_id`: event to open at `/requests/<event_id>#arrangement-reviews`.
- `flag_id`: join to `arrangement_review_flags.id` for venue/equipment booking ID,
  reason code, open/resolved status and resolution history.
- `detail`: readable reason at creation; `created_at`: server timestamp.
- Unique `flag_id` prevents duplicate notices for the same flag. Separate reasons
  generate separate notices, although UI arrangement counts deduplicate bookings.
- Creation is atomic with the approval and flag; a failed notice insert rolls back
  the approval. No historical backfill. Migration replay preserves existing records.
- Browser reads require both the original recipient and current assignment, with
  coordinator role. After reassignment, the new coordinator can read event flags,
  but old notices are not automatically readdressed or redelivered.

Repository comparison: US10 also uses a separate per-feature notification table;
US17 additionally connects its own notifications to `notification_outbox`. The
existing send-review-notifications function consumes that outbox, not the US41
notification table. No frontend consumer or email-outbox bridge currently reads
US41 notices. The notification owner must integrate this source; it is not already
wired into a shared inbox, dispatcher or email channel. US41 badges and reasons
are visible independently of that future delivery integration.

## Behavior and dependency limits

- Active venue checks include pending/confirmed bookings and unexpired holds.
  Rejected, cancelled and expired arrangements are excluded.
- Equipment checks require actual reserved/checked-out allocations. A requirement
  marked Unavailable with 0 units reserved is not an existing reservation. A booking
  created after approval is not retrospectively flagged by that earlier approval.
- Equipment return extensions are preserved per allocated item. Reservations remain
  date-based under the existing equipment model.
- Venue checks reuse `venue_review_cells` and the current AM/PM/Night ledger. US41
  does not independently implement Week 7 fifteen-minute booking support. It must
  stay aligned when the shared booking implementation changes.
- Capacity currently uses event-level attendance/layout; per-session or per-booking
  requirements must be integrated when the shared model supports them.
- Free-text accessibility/layout/equipment changes generate manual-review explanations;
  they do not prove incompatibility automatically. Significance remains owned by US7.
- `event_change_revalidations.checked_at` means checks executed, not all issues resolved.
  Its legacy status stays pending; use open flags for outstanding reviews.

## User interface

Assigned coordinator request cards display Needs review and distinct arrangement
counts. Below Current status, a matching notice links to Arrangement reviews.
The panel groups all open reasons under their arrangement, showing booking references,
venue names where readable and Singapore timestamps. Only the assigned coordinator
sees the controls; database RLS independently enforces access.

Reads refresh on focus, every 30 seconds and via refresh controls. A saved resolution
reloads the panel and its count. Resolved entries move into read-only history.
Request-card counts refresh on returning to Requests/focus or explicit refresh.
Errors are displayed rather than interpreted as an empty list. Saving prevents
pending duplicate submissions and keeps explanations when a write fails. For an
uncertain network result, refresh to inspect server state before retrying.

## Automated coverage

Code-first development; these are not TDD red/green records. Twenty-two US41 cases:
eleven database integration cases and eleven frontend service/component/page cases.

Database: `backend/supabase/tests/arrangement_revalidation.sql`, plus replay in
`run_change_request_review.sh`. Real approval RPCs, triggers and RLS run in disposable
PostgreSQL, not the shared project.

- AC-041.1.1 — Happy: independent requirement reasons preserve earlier flags.
- AC-041.1.2 — Regression: bookings, claims and allocations remain unchanged.
- AC-041.1.3 — Regression: replay preserves flags and notices.
- AC-041.1.4 — Negative: notice-write failure rolls back approval and review records.
- AC-041.2.1 — Happy/negative: timing conflicts checked per venue and reserved unit;
  a free new interval gets review without a false conflict.
- AC-041.3.1 — Boundary: attendance equal to layout capacity remains suitable.
- AC-041.3.2 — Happy/negative: flag only the undersized venue, including actual capacity.
- AC-041.4.1 — Happy: each reason has one correctly addressed notification record.
- AC-041.5.1 — Negative: ordinary, rejected and unapproved changes produce no flags.
- AC-041.6.1 — Happy/negative: assigned-only resolution, required note, both methods,
  retained history and refusal to overwrite a resolution.

Frontend: arrangementReviewService, ArrangementReviewPanel, ArrangementReviewIndicators,
ArrangementResolution, ChangeRequestReviewPage and eventReviewService test files.
Services are mocked in UI tests; the SQL cases independently cover server permissions.

- AC-041.1.5 — Service unit, happy/boundary: event-scoped reads, projection and mapping
  of open/resolved records, stable ordering and empty results.
- AC-041.1.6 — Service unit, negative: invalid ID, malformed response and read failures.
- AC-041.1.7 — Component, happy: grouped reasons, references, Singapore dates and count.
- AC-041.1.8 — Component, negative/boundary: loading, failure, retry and event changes.
- AC-041.1.9 — Page integration, happy/negative: assigned-only section and status notice.
- AC-041.1.10 — Service unit, regression: real detail projection includes coordinator ID.
- AC-041.1.11 — Service unit, happy/negative: distinct counts and failure handling.
- AC-041.1.12 — Page integration, happy/negative: assigned-only list indicators and refresh.
- AC-041.6.2 — Service unit, happy/negative: resolution input, RPC and failure handling.
- AC-041.6.3 — Component integration, happy/boundary: individual resolutions, remaining
  flags, final count removal and retained actor/method/note/time in history.
- AC-041.6.4 — Component, negative: missing/blank explanation, duplicate submissions,
  save errors preserving input and locking after success.

## Verification and manual evidence

Recorded implementation verification, 13 October 2026:
- Complete disposable database runner passed, including ten new US41 cases and
  existing regression/concurrency coverage.
- Latest full frontend run: 110 files, 1,003 passing tests, one existing TODO.
- Lint and production build passed; existing bundle-size warning remains.
- No new test run is claimed for this documentation-only close-out.
- Merged PRs #86/#87/#88 are visible in Git history. Jaydon confirmed the merges and
  shared deployment of 0052; shared Supabase was not queried during this close-out.

Manual results reported by Jaydon on 13 October 2026:
- Request-list indicators, top status notice and detailed review UI worked — Pass.
- One venue booking with capacity and timing reasons counted as one arrangement — Pass.
- Approved equipment change after actual reservation increased count from 1 to 2 — Pass.
- Resolving the equipment reason reduced count from 2 to 1, leaving venue review — Pass.
- Resolution history persisted after reloading — Pass.

Do not expand these reports into claims that every suggested browser scenario was
executed. Both resolution methods, invalid submissions, server permission rejection,
booking preservation and atomic failures have automated evidence; no separate manual
pass is claimed for those scenarios or for notification delivery.

## Defects and test-sensitivity evidence

- Product defect: event detail omitted coordinator_id, hiding the review section.
  Fixed projection; AC-041.1.10 failed before the fix and passed afterwards. Jaydon
  subsequently confirmed the UI worked. Record in the shared manual-defect records.
- Test defect: AC-041.1.7 asserted count before its React effect completed in CI.
  Fixed by waiting for the callback with unchanged expected values. Full suite passed
  locally and the follow-up is included in merged PR #87. Use its actual CI links
  in the evidence sheet; no new CI verification was performed during close-out.
- Forced-break .1.7 deliberately discarded all but the last reason; unchanged test
  failed for the missing reason and passed after byte-for-byte restoration.
- Forced-break .6.3 omitted the post-save refresh; unchanged test failed for missing
  history and passed after byte-for-byte restoration.

Logs are under `docs/test-evidence/us41/`: the forced-break/restored-pass pairs for
AC-041.1.7 and AC-041.6.3. These mutations are test-sensitivity evidence, not product
bugs or TDD cycles. Non-selected cases are skipped in those logs.

## Administrative close-out

AC3 follow-up identified during the final audit. Remaining actions:
- Review/merge migration 0053 and deploy it to shared Supabase; recheck the layout/attendance sequence.
- Add AC-041.3.3 and the stale-layout defect/fix to the evidence sheet. The existing sheet entries are already recorded.
- Commit/review this documentation close-out.
- Update the shared test overview, manual results and defect records; ownership Jaydon.
  Keep automated-run evidence in GitHub Actions, not duplicated in the spreadsheet run tab.
- Record AC4's producer/delivery boundary and notification integration dependency in Jira.
- Mark US41 Done through the team's agreed review/Definition of Done process. Do not
  describe notification delivery or fifteen-minute venue booking as implemented by US41.


## AC3 follow-up — migration 0053 (13 October 2026)

A final audit reproduced a missed capacity flag: an approved change from Theatre
(capacity 200) to Classroom (150), followed by attendance increasing to 160, used
an older structured Theatre requirement. Existing tests passed but did not exercise
consecutive layout and attendance approvals.

0053 replaces only `check_changed_arrangements`. For attendance checks, structured
requirements are used only when saved after the latest approved layout change;
otherwise the current approved event layout is used. A later coordinator save of
venue requirements confirms that complete structured selection, including layout.
Equal timestamps conservatively favour the approved event layout. Missing or unknown
layout capacity still produces a manual-review reason. No booking/claim/allocation
is updated and existing flags are neither rewritten nor backfilled.

AC-041.3.3 in `arrangement_layout_capacity.sql` covers the consecutive approvals and
later coordinator confirmation in one regression case. The runner reapplies 0053
after its intentional historical 0052 replay so it tests the current function.
The original defect was reproduced in a disposable database before the correction.
This is code-first defect/regression evidence, not a new TDD cycle.

Verification: the complete disposable database runner passed with 0053 and
AC-041.3.3, including the existing concurrency checks. No frontend code changed;
the preceding audit passed 35 relevant frontend tests. CI is pending the user push.

0053 remains local and has not been applied to shared Supabase. Jaydon handles the
commit, push, PR and deployment. Review the shared-notification dependency separately;
this fix does not introduce delivery or change the AC4 agreement.
