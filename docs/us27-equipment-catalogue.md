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

## Remaining story scope

PR3 must add the Technical Support status form and history using the displayed version,
preserve notes on failure and require reload after uncertain/stale decisions. Coordinator
catalogue access stays read-only. Manual verification of the new status flow follows
deployment of 0105 and the later UI. No repair-return scheduling or automatic rebooking.

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

PR2 is backend-only. Apply 0105 after the existing schema and 0104, before the later
status UI. The PR1 frontend remains compatible. Deployment is Jaydon's responsibility;
0105 has not been applied to shared Supabase. No additional frontend-suite pass is
claimed for backend-only work; the previous PR1 frontend result is historical evidence.

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
