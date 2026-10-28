# US24 test cases

Owner: Jaydon. Updated: 28 October 2026. Code-first development.

PR1 has 23 grouped PostgreSQL integration cases. Auth claims are simulated; database
permissions, constraints, state changes, rollback and concurrency are real. Related
assertions share one ID. No frontend unit/component or manual pass is claimed for PR1.

| ID | Classification | Scenario and expected outcome |
|---|---|---|
| AC-024.1.1 | Integration — Happy path / Boundary | Out includes collection/return day; yesterday's return is pending. Future/cancelled allocations are excluded; actual allocated asset is shown. |
| AC-024.1.2 | Integration — Happy path | No-issue inspection records authenticated staff/time, creates no defect report/status change and completes only its allocation. |
| AC-024.1.3 | Integration — Negative / Regression | A stale duplicate submission cannot create another inspection. |
| AC-024.1.4 | Integration — Negative / Boundary | Blank issues, invalid findings/status, missing status-change reason, Operational missing result, wrong consent and unknown allocations refuse with unchanged snapshots. |
| AC-024.1.5 | Integration — Boundary | Inspection refuses on the saved return day; it becomes eligible only after that Singapore date. |
| AC-024.1.6 | Integration — Happy path / Regression | Missing remains pending with history; later explicit follow-up resolves it without deleting its original report. |
| AC-024.1.7 | Integration — Negative | Every other role, including Safety Officer, and signed-out callers are refused; internal history is hidden by RLS and anonymous execution denied. |
| AC-024.1.8 | Integration — Negative | Direct report/history writes, deletion and private helper access cannot bypass the checked operation. |
| AC-024.1.9 | Integration — Boundary / Regression | Simultaneous inspectors accept exactly one displayed allocation version and one inspection. |
| AC-024.1.10 | Integration — Negative | Even fresh versions cannot inspect cancelled allocations or reopen completed inspections. |
| AC-024.2.1 | Integration — Happy path | Damage report links the actual allocation/unit, trimmed findings and authenticated US27 status audit. |
| AC-024.2.2 | Integration — Boundary / Regression | Separate allocation findings are retained without duplicate same-status audit; no-issue keeps Damaged/legacy statuses. |
| AC-024.2.3 | Integration — Boundary / Regression | A concurrent US27 status change invalidates inspection consent rather than being overwritten. |
| AC-024.2.4 | Integration — Happy path | Other findings can select Under Maintenance via the shared status operation. |
| AC-024.3.1 | Integration — Happy path / Negative | Damage immediately excludes the unit from a free future window and the actual reservation operation refuses it. |
| AC-024.3.2 | Integration — Happy path / Regression | US27 flags/notifies an affected future booking, retaining it and its independent review reason. |
| AC-024.3.3 | Integration — Happy path | Missing becomes Unavailable. |
| AC-024.3.4 | Integration — Regression | Original allocation dates/states/timestamps, locations and event records are preserved. |
| AC-024.3.5 | Integration — Negative / Regression | Injected final-write failure rolls back status, audit, defect, inspection, allocation version, reviews and notices. |
| AC-024.3.6 | Integration — Boundary / Regression | Reservation wins type lock; inspection sees its new future allocation and flags it without removing it. |
| AC-024.3.7 | Integration — Boundary / Regression | Inspection wins type lock; waiting reservation rechecks and refuses damaged equipment. |
| AC-024.3.8 | Integration — Regression | Replaying 0112 preserves populated inspections, reports, status history, events, allocations and reviews/notices. |
| AC-024.3.9 | Integration — Regression | Adding 0112 preserves legacy reports, units and allocation fields, with only the new version field defaulted. |

Sources under `backend/supabase/tests/`: `equipment_return_fixture.sql`,
`equipment_return_inspections.sql`, `equipment_return_races.sh`,
`equipment_return_replay.sql`, and `run_equipment_returns.sh`. The focused runner
also runs after the existing historical and current upgrade/fresh gates.

Expected validation refusals, losing concurrent calls and deliberate injected failures
are not discovered defects. Genuine product failures, if found, are recorded separately
with retained evidence. Results are summarised in `docs/test-evidence/us24/pr1/README.md`.

## PR2 frontend cases

Fourteen new cases bring US24 to 37 grouped cases (23 database integration, six unit,
eight component). Unit tests mock Supabase or exercise pure validation. Component tests
render the page/form/navigation with mocked services and session context; they are not
live database, Auth or browser end-to-end tests. Backend permissions, atomicity and
availability remain covered by PR1's integration cases.

| ID | Classification | Scenario and expected outcome |
|---|---|---|
| AC-024.1.11 | Unit — Happy path / Boundary | Loads the protected operation, preserves allocation-specific history and accepts valid empty lists. |
| AC-024.1.12 | Unit — Negative / Boundary | Malformed/null lists, invalid dates/ranges, duplicate or contradictory work rows, invalid history and interrupted reads fail rather than becoming empty success. |
| AC-024.1.13 | Component — Happy path / Boundary | Out/Pending checks/History show server-classified allocations, actual identities/dates, missing follow-up, legacy status meanings and stored staff/Singapore time across midnight. |
| AC-024.1.14 | Component — Negative / Boundary | Loading/error differ from empty lists; retry restores data and refresh removes obsolete rows. |
| AC-024.1.15 | Component — Happy path / Negative / Regression | Only Technical Support sees navigation and loads returns; other roles/signed-out users are denied. Auth loading does not fetch and role loss hides late list results. |
| AC-024.1.16 | Component — Happy path / Negative | Requires explicit findings/issue descriptions; Missing forces Unavailable and No issues keeps the current Damaged status by default. |
| AC-024.1.17 | Component — Boundary | Pending save cannot duplicate, edit, reload, close, switch tabs or open another allocation. |
| AC-024.1.18 | Component — Negative / Regression | Stale/uncertain saves keep findings and require explicit reload; refreshed consent/current status is used, failed/obsolete reloads keep the form locked without discarding notes. |
| AC-024.2.5 | Unit — Happy path / Negative / Boundary | Supports all issue/status choices, trims descriptions, preserves legacy/current status for No issues, forces Missing to Unavailable and rejects invalid source versions/unsupported targets or missing reasons. |
| AC-024.2.6 | Unit — Happy path / Regression | Sends only allocation/displayed consent/findings/status; no actor/time/unit substitution. Accepts consistent legacy, unchanged-status, changed-status and missing receipts. |
| AC-024.2.7 | Unit — Negative | Invalid inputs never send; malformed, mismatched allocation/finding/status/version/resolution or interrupted receipts cannot report success. |
| AC-024.2.8 | Component — Happy path / Regression | Confirmed save closes management, refreshes partial results and lets another unit be inspected; Missing stays pending and reopening uses its fresh current status. |
| AC-024.3.10 | Unit — Negative | Permission, stale, ineligible and uncertain responses have safe distinct messages without private database details. |
| AC-024.3.11 | Component — Negative / Regression | Role/account changes unmount inspection and ignore late saves and old-account list results. |

Sources: `equipmentReturnService.test.ts`, `EquipmentReturns.test.tsx` and the shared
fixture `fixtures/equipmentReturns.ts` under `frontend/src/features/equipment/__tests__/`.
All 14 new cases passed; full suite passed 1,590 tests / 189 files. Lint/typecheck
and the matched-copy production build passed. Results/limits:
`docs/test-evidence/us24/pr2/README.md`. Jaydon confirmed the eight chat manual
check groups passed on 29 October 2026; see `docs/test-evidence/us24/manual-results.md`.
PR1's database results are not presented as new PR2 runs.

Next unused IDs: AC-024.1.19, AC-024.2.9, AC-024.3.12.
