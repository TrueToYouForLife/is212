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

## Remaining story scope

AC-027.5–8: status changes with a note, authenticated actor/time audit, immediate
exclusion from reservable stock, and review/notification of affected upcoming
reservations. Existing 0025 availability already selects Operational units only;
status changes must share its per-type lock. Preserve allocations and independent
review reasons. Reuse the current notification helpers/preferences and support
future US24 callers; no expected repair-return dates or automatic rebooking.

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
Manual Supabase/UI checks and shared evidence-sheet updates remain pending.
No live email delivery is claimed. Provide sheet rows directly in chat.

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
