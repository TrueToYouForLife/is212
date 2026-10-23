# US27 — Equipment catalogue and status

Owner: Jaydon. Jira: SCRUM-225. Updated: 23 October 2026.
Code-first development, delivered in separate PR portions.

## PR1: catalogue (AC-027.1–4)

Migration `0104_equipment_catalogue.sql` adds the role-checked, read-only
`get_equipment_catalogue()` RPC. It projects existing types and units from 0019;
there is no second inventory. Only authenticated Technical Support and Event
Coordinators may call it. Coordinators receive no new direct unit-table permissions,
allocation data or write access. Existing Organiser equipment-type choices (0054)
and owner-only arrangement summaries (0071) are preserved.

The new **Equipment catalogue** link opens `/equipment/catalogue` for both roles.
The existing `/equipment` requirements and `/equipment/reservations` workflows remain.
Unit rows show asset tag, type, description (`equipment_types.notes`), current venue
and location description, and operational status. Missing descriptions are explicit.
Stock totals include types with zero units. Usable counts only Operational units,
including Operational units reserved for other dates; it does not promise availability
for an event. Totals remain global while the three unit filters intersect.

Existing status values are displayed as Operational, Damaged (`needs_repair`),
Under Maintenance (`under_repair`), and Unavailable. Retired and missing units
retain their specific reasons; both match the Unavailable filter. No saved status
is rewritten. Counts and units come from one database snapshot. Refresh replaces
the catalogue; failures are errors, never an empty successful result.

No equipment creation/deletion or status mutation controls are included. The old
Technical Support direct-write policy is unchanged in this read-only portion;
the next portion must replace status writes with a checked operation so audit,
reservation locks and affected-reservation handling cannot be bypassed.

## PR2: status backend (AC-027.5–8)

Claimed migration `0105_equipment_status_changes.sql` adds:

- `get_equipment_status(p_item uuid)`: Technical Support-only current status/version
  and immutable history, newest version first. Coordinators retain catalogue access
  but do not receive internal staff history.
- `set_equipment_status(p_item uuid,p_status text,p_note text,p_version bigint)`:
  Technical Support-only versioned change. Targets are `operational`, `needs_repair`
  (Damaged), `under_repair` (Under Maintenance), and new `unavailable`. Existing
  retired/missing values are preserved and may be changed through this same operation.
  Notes are mandatory and trimmed. Actor/name/time come from the authenticated
  session/database. No-op changes produce no history or notices; stale versions fail.
- `equipment_status_changes`: append-only application history. No browser writes.
  The old table-level unit UPDATE grant is replaced with grants on unrelated
  columns; a trigger also guards direct status/version changes. Administration of
  asset tags, locations and condition retains its existing Technical Support policy.

The operation shares US14's type advisory lock, then locks/reloads the unit. Existing
`equipment_free_units` and reservation functions already require Operational units,
so no competing availability implementation is added. Both possible reservation/status
lock orderings are tested. Restoring Operational changes eligibility but does not move
reservations, remove review reasons or automatically rebook anything.

A non-operational change creates one review per affected equipment booking, linked to
the exact status-change audit. It includes upcoming Approved/Planning/Confirmed events
with reserved or checked-out allocations; past/started events, closed bookings/events
and returned/cancelled allocations are excluded. An unassigned event is still flagged
without notifying its historical requester. Every changed status gets its own source;
multiple reasons stay independent and resolve through the existing Coordinator workflow.
Events, bookings, quantities and allocations remain intact.

Review insertion, audit, status/version and notices commit or roll back together.
Notifications reuse **Arrangements needing review**, `notification_channels` and
`queue_notification_email`; in-app copies use the existing review-notification table,
so the feed shows one copy rather than duplicating typed email. In-app and email choices
are independent. This new producer sends email by default unless preferences disable
it; the notification type metadata now records that email is supported. Existing review
producers/helpers are not replaced. Emails are queued, not claimed delivered.

Shared contracts to flag for review: US14 reservation lock/availability; US41/US20
review source/reason constraints; US33 notification type/channel helpers. Additive
constraint changes preserve existing reasons/sources. The historical runner restores
0105 after older review-schema replays. Future US24 integration must call the checked
status operation rather than update operational_status directly.

## PR3: Technical Support status form and history

Technical Support opens **Manage status** beside a unit in the existing catalogue.
The panel loads the current status/version and recorded history. Four explicit targets
are offered; no selection is inferred from legacy retired/missing statuses. Saving
requires a reason, and sends the displayed version without actor/time fields.

An in-flight save disables editing, reload and close; another unit cannot be opened
until the panel closes. Failed saves retain the note and selected target, disable retry,
and require **Reload unit**. Reload shows the latest status/history while keeping the
note and target for review. No polling or silent consent refresh is added. Loading
failure is an error, not a false empty history.

Successful saves close the panel automatically and reload catalogue counts/rows,
preserving filters and showing the success message. Another unit can then be managed
without a separate close step. Reopening a unit loads fresh status/history/version.
A confirmed no-op also closes and explicitly reports no new history/notices. History
uses the stored staff name, reason and Singapore time. It is not exposed to Coordinators.
Role/user changes unmount management and ignore late responses. Backend permissions
remain the enforcement boundary; no equipment creation/deletion controls are added.

No new migration is needed. Jaydon confirmed PR2 merged and 0105 applied before this
portion. Jaydon reported status-flow manual checks passed, then separately confirmed
the auto-close refinement passed on 23 October 2026. Exact fixture/account IDs and
email delivery were not supplied. Shared evidence-sheet update remains pending.
No repair-return scheduling, temporary catalogue seeding or automatic rebooking is added.

Local PR3 verification: 11 new frontend cases and six catalogue regressions passed in
the targeted retest; full suite passed 1,535 tests / 177 files. Coverage: 96.12% lines/
statements, 90.60% branches, 95.22% functions. Typecheck, lint and production build passed.
AC-027.2.3 found/fixed a stale open panel after a fast batched catalogue refresh; the
panel was initially keyed by refresh revision; Jaydon's later usability refinement
closes it after a confirmed save, with fresh status/history/version loaded on reopening. Failure and
retest evidence: `docs/test-evidence/us27/pr3/`. No new database rerun is claimed.

Architecture: the existing Equipment Booking module supplies catalogue/status to
US13 requirements and US14 reservation planning. Changes can affect arrangement
readiness and Coordinator review. Equipment returns are a separate follow-up.
The architecture diagrams describe the target, not implementation completion.

## Deployment and verification

Apply 0104 after the existing schema (including 0054) and before deploying this
frontend. It adds a function and execution grant only, with no data backfill,
reservation rewrite or existing-function override. Jaydon handles deployment.

Cases: `docs/test-cases/US27_test_cases.md`. Local evidence lives under
`docs/test-evidence/us27/`. SQL uses disposable PostgreSQL, simulated Auth claims
and real permissions; frontend tests mock services/the Supabase client.
New status-flow manual Supabase/UI checks and shared evidence-sheet updates remain pending.
No live email delivery is claimed. Provide sheet rows directly in chat.

PR1 merged in #142. Jaydon confirmed 0104 applied and all seven chat manual groups
passed on 23 October 2026: details/counts, filters/reset/refresh, no mutation controls,
Coordinator access, Organiser/Attendee refusal and existing equipment workflows.
Exact fixture/account IDs were not supplied; offline recovery and zero-stock-specific
manual scenarios were not separately confirmed. Evidence-sheet update is not claimed.

PR2 was backend-only and is merged; Jaydon confirmed 0105 applied. PR3 requires that
migration before its frontend is deployed. Deployment is Jaydon's responsibility.
The previous PR1 frontend result below is historical evidence, not a PR3 test run.

Local PR2 verification passed: 18 grouped status integration cases, three races,
populated migration replay, and historical/upgrade/fresh-order database gates (exit 0).
Evidence: `docs/test-evidence/us27/pr2/`. No product defect was demonstrated; the
initial race fixture's malformed UUID was fixed in test code.

Local PR1 verification: all 11 grouped US27 cases passed (eight frontend, three SQL).
Full frontend run: 1,524 tests across 175 files; build/typecheck and lint passed.
Focused, historical, quarter-hour upgrade and fresh-order database gates all exited 0,
including existing concurrency regressions. No product defect was demonstrated.
The unsupported Vitest matcher and Docker approval/startup interruption were test/tool
issues. These local results do not claim GitHub CI or manual acceptance.

## Manual checklist after deployment

Use existing seeded data and separate Technical Support, Coordinator, Organiser
and Attendee accounts. Do not create or alter shared stock just for this PR.

1. Technical Support: open Equipment catalogue. Compare known asset tags, type
   description, current location and status with the seeded catalogue.
2. Compare total and usable counts with known inventory. Non-operational units
   remain in totals but not usable counts. Where present, a zero-unit type shows 0/0.
3. Combine type/location/status filters, find a no-match combination, reset and
   refresh. Global totals stay unchanged by filters. Retired/missing units match
   Unavailable and keep their reasons. No add/delete/status-edit controls appear.
4. Coordinator: repeat catalogue browsing; existing request/reservation workflows
   remain available to their original roles.
5. Organiser and Attendee: no catalogue navigation; direct catalogue URL refuses
   access. Organiser equipment choices and confirmed equipment summaries still work.
6. Temporarily simulate an offline browser while refreshing. An error appears;
   restoring connectivity and retrying reloads current stock. Record actual results
   and any defects in the evidence sheet; no manual pass has been recorded yet.

## PR3 manual status checklist

Jaydon reported the chat status-flow checks passed and separately confirmed auto-close
passed after the refinement. The broader checklist below remains a reusable guide;
do not infer separate execution of every optional scenario or delivered email.

Use authenticated Technical Support and Coordinator accounts, disposable future events,
and existing equipment units. Record the original unit status before changing it.
Do not treat queued email as evidence of delivery.

1. Technical Support: open a unit's **Manage status** panel. Check current status,
   available four targets and history. Blank/whitespace-only reasons refuse saving.
   Change an unreserved unit with a reason; verify the row/counts update and history
   records your real account, note, old/new status and Singapore time. Where suitable,
   verify Damaged, Under Maintenance, Unavailable and Operational transitions.
2. Keep a type/status filter active while changing a matching unit. Global usable
   counts update; filters stay selected, and a unit that no longer matches disappears
   from rows and its panel closes automatically. Open another unit directly, then
   reopen the saved unit to check fresh history. No add/delete controls exist.
3. Coordinator records a requirement for a disposable upcoming event; Technical Support
   reserves it. Identify the actual allocated unit (read-only lookup below if needed),
   mark it non-operational, then Coordinator reloads event details and notifications.
   The event/booking/quantity stay intact, a review identifies the unit and reason,
   and unrelated review reasons remain. A new request cannot reserve that unit.
4. Restore the unit to Operational. A conflict-free future request can use it again;
   existing review reasons remain until the Coordinator explicitly resolves them.
5. Open the same unit in two Technical Support tabs. Save from one, then attempt the
   old version in the other: stale save is refused, note stays, retry is disabled.
   Explicitly reload, review the new status and save with the retained note.
6. Simulate a failed request/offline save on an unreserved test unit. The UI keeps the
   note and requires reload before retry. Check actual history after reconnecting:
   a lost response may have committed, so do not assume the operation failed.
7. Coordinator can browse the catalogue but has no management/history controls.
   Organiser and Attendee remain denied catalogue access. Existing requests,
   reservations and Organiser arrangement summaries still work.
8. Where notification preferences are enabled, verify in-app-only/email-only choices
   for **Arrangements needing review**. Reviews must persist independently of channels.
   Email outbox/queuing and actual email delivery are distinct results.

Read-only administrative lookup to identify a test event's actual reserved units:

```sql
select e.reference, i.asset_tag, i.id as item_id, a.status
from public.equipment_allocations a
join public.equipment_items i on i.id = a.item_id
join public.equipment_booking_lines l on l.id = a.line_id
join public.equipment_bookings b on b.id = l.booking_id
join public.events e on e.id = b.event_id
where e.reference = 'YOUR-TEST-EVENT-REFERENCE'
  and a.status in ('reserved', 'checked_out');
```

Use real signed-in accounts for UI actions. Manual results above are Jaydon-reported;
individual execution timestamps, fixture IDs and delivery results were not supplied.
