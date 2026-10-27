# US24 — Equipment return inspections

Owner: Jaydon. Jira: SCRUM-69. Updated: 27 October 2026. Code-first development.
Branch: `us24-return-inspection-backend`. Jaydon claimed migration 0112.

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
PR2 is the return page/form/history; frontend and manual acceptance remain pending.

## Manual checks for PR2

Use authenticated Technical Support accounts and existing allocated test units, with
saved return dates before/today/after the Singapore day. Confirm Out/Pending checks
classification, actual asset tags and a no-issue inspection. Inspect one unit from a
multi-unit event and confirm the others remain pending. Record damage and check the
catalogue status/counts, a future reservation refusal and the assigned Coordinator's
review/notice while its reservation remains intact. Report missing and later resolve
it with an explicit follow-up, preserving both history entries. Confirm no-issue does
not silently restore Damaged/legacy statuses. Test stale saves in two staff sessions,
input retention/reload, and role denial. Record actual manual results rather than
inferring them from automated logs. Exact UI steps will accompany PR2.

Evidence-sheet rows are supplied in chat, not repository TSV files. Do not populate
Automated Test Case Runs. Manual passes, deployment, CI results and delivered email
are not claimed by local database logs.
