# US24 — Equipment return inspections

Owner: Jaydon. Jira: SCRUM-69. Updated: 29 October 2026. Code-first development.
PR1 branch: `us24-return-inspection-backend`; PR2: `us24-return-inspection-ui`.
Jaydon claimed migration 0112 and confirmed it applied after the backend PR merged.

## Agreed scope and assumptions

US24 records return findings and the resulting operational status, updating availability
through US27. It does not introduce a physical checkout/handover workflow. Equipment
is treated as scheduled out for its US14 allocation window, including transfer days.
Dates, not physical handover evidence, drive the display. No job or automatic allocation
status updates are needed. Saved windows, allocation states, returned_at, locations,
events and other units are not rewritten.

The UI portion will have Out, Pending checks and History tabs. Out includes the saved
collection day through the return day, inclusive, in Singapore time. Pending checks
starts the following Singapore day for non-cancelled allocations without a completed
inspection. Future allocations are omitted. Existing returned allocations can still
need inspection; historical allocation state alone does not invent an inspection.
Completed/past events remain inspectable. Cancellation of an allocation excludes it
from work queues, but does not erase existing inspection history.

Pending checks alone does not exclude otherwise Operational equipment from a future
reservation. US14's allocation windows and US27's operational status remain authoritative.
There is no early release/same-day reuse or new overdue-loan policy. Missing findings
set Unavailable and stay pending until a later explicit inspection resolves them.
No-issue findings keep the current status, including legacy values, unless staff
explicitly select a supported change and give its reason. A no-issue inspection does
not imply a storage-location change or physical return timestamp.

## PR1 backend

`0112_equipment_return_inspections.sql` adds per-allocation inspection versions and
append-only application inspection records. Findings are good (no issues), defect,
damage, missing and other. Existing `equipment_defect_reports` are reused for issues;
no-issue inspections do not fabricate defect reports. The report status constraint
additively accepts US27's Unavailable value; older reports are retained.

One unit can have several event allocations, each with its own inspection. A new
finding remains recordable when its resulting operational status is unchanged. A
missing allocation can receive follow-up inspections; completed non-missing inspections
cannot be overwritten/reopened through the application. Actor/name/time are taken from
the authenticated session and database. No client actor or timestamp is accepted.

### Contracts

- `get_equipment_return_inspections()` is Technical Support-only. Returns `out`,
  `pendingChecks` and `history` arrays, ordered by return date/ID for work queues and
  newest inspection first for history. Each queue row contains allocation/event/unit
  identities, asset tag/type, saved collection/return dates, allocation state, current
  operational status/version, a consent `version` and last-inspection context.
- `inspect_equipment_return(p_allocation uuid,p_version text,p_finding text,
  p_description text default null,p_status text default null)` saves one allocation.
  It validates ownership/linkage by loading the actual allocation rather than trusting
  a submitted unit ID. Issues require descriptions; defect/damage/other require one of
  US27's four explicit status targets. Missing defaults to and requires Unavailable.
  Good defaults to retaining current status; an explicit change requires a reason.
- Consent includes the allocation (including dates/state/inspection version) and the
  unit's type/status/version. A competing inspection, date change or US27 status edit
  invalidates the displayed version. Stale saves return 40001; invalid/ineligible input
  returns 22023; other roles/signed-out callers return 42501. An uncertain response
  must be reloaded before any retry; it is not proof that the transaction failed.
- A successful receipt identifies the inspection/allocation, inspection version,
  finding, whether resolved, resulting status/version, statusChanged and reviewCount.
- `equipment_return_inspections` records the old/new status, linked status audit and
  optional defect report. Only Technical Support can read it. Browser writes to this
  history or defect reports are denied; the checked operation owns new reports.
  `equipment_return_version` is private.

Type-first locking is shared with US14 and US27. The unit/allocation are re-read under
locks; status changes call `set_equipment_status` inside the same database transaction.
Inspection/report/audit/version/reviews/notices commit or roll back together. Existing
upcoming reservations and independent review reasons remain; notices use existing
channel preferences. Queued email is not proof of delivery.

## PR2 Technical Support interface

PR1 is merged and Jaydon confirmed 0112 applied. No new migration is needed for PR2.
Technical Support opens **Equipment returns** at `/equipment/returns`. The page defaults
to Pending checks, with Out and History tabs and counts. Work rows show event/reference,
type, actual asset tag, saved collection/return dates and operational status. Out is
scheduled visibility, not proof of physical handover. Only Pending checks offers an
inspection action. History displays stored findings, old/new status, staff name and
Singapore timestamp; it does not invent inspection records for legacy defect reports.

The form requires an explicit finding. No issues defaults to keeping the current
status, including legacy Damaged/retired/missing values. Issues require descriptions;
defect/damage/other also require an explicit supported status. Missing selects and
locks Unavailable. Changing status on a No issues inspection requires a reason when
the selected value differs. These are client UX checks; 0112 remains authoritative.

Saving calls only the checked inspection operation, with displayed allocation consent;
no separate report/status request, client actor/time or substituted unit ID is sent.
Confirmed saves close the form and reload the lists. Other units stay independently
inspectable. Missing stays pending with a visible follow-up indicator. Restoring
Operational does not resolve independent review reasons or change storage location.

Pending saves block editing, close/reload, list refresh, tab switching and opening a
second allocation. A failed/stale/uncertain result keeps notes and selections and locks
retry; only explicit Reload allocation refreshes consent. Reload retains findings and
shows current status; if the allocation is no longer pending, saving remains blocked
and notes remain available for reference. No polling or silent consent refresh is added.
Role/account changes unmount the view/form and ignore late responses. The navigation
and direct page admit Technical Support only; backend enforcement remains unchanged.

PR2 automated verification: 14 new cases passed; full frontend suite passed 1,590
tests / 189 files. Overall coverage: 96.27% lines/statements, 90.84% branches, 95.18%
functions. Lint/typecheck passed. The initial build failed on an OS file-read timeout;
a disposable copy with matching source/manifests and lockfile-installed dependencies
built successfully. No project dependency/configuration changes or product defect
were demonstrated. Environment failures and final evidence: `docs/test-evidence/us24/pr2/`.
Jaydon reported all eight chat manual-check groups passed on 29 October 2026.
Results and limitations: `docs/test-evidence/us24/manual-results.md`. CI and frontend
merge/deployment remain pending.

Supabase calls and response validation live in `equipmentReturnService.ts`; pure form
rules live in `equipmentReturnValidation.ts`. Existing status labels/targets and date
formatting are reused; the catalogue's general status editor is unchanged.

## Shared integration

Yuan Long should review the allocation version addition, protected defect writes and
preserved US14 windows. There is no new writer for physical checkout/returned states.
Existing US27 status APIs and catalogue behaviour remain supported.

Jeremiah should be aware that return findings reuse US27's existing review/notification
producer. Its event eligibility currently covers Approved/Planning/Confirmed; broadening
that to the safety stages is the previously identified US27/safety integration work,
not silently included in this return-inspection migration. No US43/US45 transition,
readiness rule, new notification type or automatic rebooking is added here.

## Verification and deployment

Cases: `docs/test-cases/US24_test_cases.md`. Local logs: `docs/test-evidence/us24/pr1/`.
SQL tests use disposable Docker PostgreSQL with simulated Auth claims and real grants,
constraints, transactions and concurrent sessions. They are not live Supabase API tests.
Final focused verification passed all 23 grouped cases, including four races, populated
replay and legacy-data preservation. Historical, upgrade and fresh gates exited 0. The
upgrade/fresh runs used the earlier 21-case test file; the final focused run includes
the last two added cases and strengthened rollback fixture. No product code changed
between these runs. No product defect was demonstrated. A test-assembly/count mismatch
was corrected before the final focused verification; it is not a product defect.

Apply 0112 after 0105 and the team's current migration baseline before deploying the
future return UI. No frontend changes are part of PR1. Jaydon handles commits, PRs,
merges and shared deployment. Nothing has been applied to shared Supabase by this work.
PR2 implements the return page/form/history. Its frontend verification is recorded
separately under `docs/test-evidence/us24/pr2/`; Jaydon has confirmed manual acceptance.

## Manual checks for PR2

Use authenticated Technical Support accounts and disposable/existing allocated test
units. Use an assigned Coordinator for future arrangement checks, and other role
accounts for denial. Record the event reference, asset tags, saved dates and original
statuses before making changes. If no past-return allocation exists, prepare agreed
disposable fixtures separately; do not backdate live event records merely for testing.

1. **Technical Support — access and lists:** open Equipment returns. Compare Pending
   checks and Out with saved allocation dates. Today is still within Out when it is the
   saved return day; pending starts the next Singapore day. Check actual event/asset
   identities. Cancelled/future allocations do not appear in work lists. Out has no
   inspection action. Refresh reflects current data; empty lists have explicit messages.
2. **Technical Support — no issues/partial inspection:** inspect one pending allocation,
   choose No issues and keep its current status. Save closes the form, moves that task
   to history and leaves the event's other units pending. Check recorded account/time.
   A unit already Damaged/legacy Unavailable is not silently restored to Operational.
3. **Technical Support — issue/status:** choose Damage (or Defect/Other), require a
   description and explicit resulting status, then save. Check the catalogue status
   and usable counts. Check future reservation availability excludes that actual unit;
   other healthy units of the same type may still satisfy a reservation. For a future
   affected allocation in US27's supported event stages, the assigned Coordinator sees
   its review/notice while the reservation and unrelated reasons remain intact.
4. **Technical Support — missing/follow-up:** choose Missing, provide a description and
   confirm Unavailable is fixed. Save leaves the task pending with a missing indicator
   and history entry. Reopen it for an explicit follow-up. No issues keeps Unavailable
   by default; restore Operational only with an explicit choice and reason if suitable.
   Both inspection entries remain in history. No storage-location update is implied.
5. **Technical Support — stale consent:** open inspection and enter findings in one
   tab. In another staff tab, change that unit's status through the existing catalogue.
   Saving the old inspection refuses, retaining its note and blocking retry. Explicitly
   reload, review the new current status and retained selections, then save if intended.
   If another staff member completed the inspection instead, reload says it is no
   longer pending and keeps the note available for reference.
6. **Technical Support — save/load failures:** where practical, use browser offline
   mode on disposable data. Load failure must not look like an empty successful list.
   An uncertain save keeps notes and requires reload: a lost response does not prove
   that the server rolled back. Reload/history determines the actual outcome.
7. **Other roles:** Coordinator, Organiser and Attendee have no Equipment returns link;
   direct `/equipment/returns` refuses access. General catalogue/status and existing
   request/reservation workflows remain available to their original roles.

Jaydon confirmed the eight-group chat checklist passed on 29 October 2026, including
issue findings, missing follow-up, stale consent, role denial and affected reservations.
The optional offline test and additional scenarios in this longer guide are not inferred
from that confirmation. Exact accounts/fixtures/timestamps and delivered email were not
supplied. Preferences and email queuing follow the existing shared producer; delivery
is a separate result.

Evidence-sheet rows are supplied in chat, not repository TSV files. Do not populate
Automated Test Case Runs. Manual passes come from Jaydon's report, not local database
logs; frontend deployment, CI results and delivered email remain unclaimed.
