# US24 test cases

Owner: Jaydon. Updated: 27 October 2026. Code-first development.

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

Next unused IDs: AC-024.1.11, AC-024.2.5, AC-024.3.10. PR2 will add requirement-based
service/component cases and role-specific manual steps without renumbering PR1 cases.
