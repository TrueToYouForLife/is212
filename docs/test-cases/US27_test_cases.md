# US27 test cases

Owner: Jaydon. Updated: 23 October 2026. Code-first development.

PR1 covers AC-027.1–4 with the 11 grouped cases below. Related assertions share
one ID. PR2's 18 backend cases for AC-027.5–8 follow; status UI cases remain for PR3.

| ID | Classification | Scenario and expected outcome |
|---|---|---|
| AC-027.1.1 | Integration — Happy path / Boundary | Technical Support sees all fixture units, type description, actual current location (different from home) and operational status; unit projection contains only catalogue fields. |
| AC-027.1.2 | Unit — Happy path / Boundary | Service uses the protected read operation and accepts a valid empty catalogue. |
| AC-027.1.3 | Unit — Negative | Permission errors, incomplete/malformed data, null responses and rejected requests return a safe error, never false empty success. |
| AC-027.1.4 | Component — Happy path / Regression | Unit details and all five legacy statuses display correctly; absent descriptions are explicit; no add/delete/status-mutation controls. |
| AC-027.1.5 | Component — Negative / Boundary | Loading failure differs from empty stock; retry restores data, refresh replaces obsolete rows and an empty catalogue is explicit. |
| AC-027.2.1 | Integration — Happy path / Boundary | Five mixed-status units count as five total/one usable even with the Operational unit reserved; a zero-unit type remains 0/0 with null description. |
| AC-027.2.2 | Component — Happy path / Boundary | Shows global total/usable counts, including zero stock, without claiming event-specific availability. |
| AC-027.3.1 | Component — Happy path / Negative / Boundary | Type/location/status filters intersect; Unavailable includes retired/missing; no-match, reset and Damaged/Maintenance filters work; totals remain global. |
| AC-027.4.1 | Integration — Happy path / Negative / Regression | Coordinator can read; all other existing roles and signed-out claims are refused; anonymous has no execution grant. Coordinator receives no direct unit read or insert permission. Exact units/bookings/allocations remain unchanged. |
| AC-027.4.2 | Component — Happy path / Negative | Only Technical Support and Coordinator see the link and load the page; all other existing roles and signed-out users cannot load catalogue data. |
| AC-027.4.3 | Component — Negative / Boundary | Auth loading never fetches; losing an allowed role unmounts the catalogue and ignores a late response. |

SQL: `backend/supabase/tests/equipment_catalogue.sql`; focused disposable runner
`run_equipment_catalogue.sh`. Also integrated into historical and current
upgrade/fresh database runners used by CI. These use simulated Auth claims, not
live Supabase Auth/API sessions. Unit service tests mock Supabase; component tests
render UI with mocked catalogue service, not browser end-to-end tests.

Frontend: `frontend/src/features/equipment/__tests__/equipmentCatalogueService.test.ts`
and `EquipmentCatalogue.test.tsx`. Existing navigation/equipment tests provide
regression coverage under their original story IDs, excluded from US27 case counts.

Manual checks: `docs/us27-equipment-catalogue.md`. Jaydon subsequently confirmed all
seven PR1 chat groups passed. Shared evidence-sheet changes are not claimed.

No product defect demonstrated so far. One unsupported Vitest matcher was corrected
in test code. Docker daemon/sandbox startup is an environment issue. Neither is a
product defect or a forced-break result.

## PR2 backend cases

All are PostgreSQL integration tests with real database permissions and simulated Auth
claims. Code was written first. Multiple assertions of one ID form one grouped case.
Failure injections test rollback; they are deliberate refusals, not discovered defects.

| ID | Classification | Scenario and expected outcome |
|---|---|---|
| AC-027.5.1 | Integration — Happy path / Regression | Both staff accounts can perform all four supported status transitions with notes; legacy retired/missing values remain readable without rewriting history. |
| AC-027.5.2 | Integration — Negative / Boundary | Refuse blank note, unsupported target, missing/stale version and unknown unit; exact snapshots remain unchanged. |
| AC-027.5.3 | Integration — Boundary | Same-status save is a no-op: no version, audit, flag or notice added. |
| AC-027.6.1 | Integration — Happy path / Boundary | Immediately exclude Damaged, Under Maintenance and Unavailable from future availability; Operational starts available. |
| AC-027.6.2 | Integration — Negative | Actual reservation operation refuses unusable stock without deciding the pending requirement. |
| AC-027.6.3 | Integration — Happy path / Regression | Operational restoration makes stock eligible without clearing existing reviews or moving allocations. |
| AC-027.6.4 | Integration — Boundary / Regression | Status transaction wins type lock; waiting reservation rechecks current status and fails without allocating. |
| AC-027.7.1 | Integration — Happy path / Boundary | Flag upcoming reserved/checked-out bookings once each, including unassigned events. Exclude past/exact-start/closed events, cancelled bookings and returned/cancelled allocations. |
| AC-027.7.2 | Integration — Regression | Compare exact event, booking, line and allocation snapshots; independent review reason stays open. |
| AC-027.7.3 | Integration — Happy path / Negative | Notify assigned Coordinator once per affected booking via both default channels; no requester fallback for unassigned event; feed contains one in-app copy without email duplication. |
| AC-027.7.4 | Integration — Boundary | Email-only, in-app-only and both-off preferences affect notices while every change still creates its own review/audit. |
| AC-027.7.5 | Integration — Negative / Regression | Inject notice and review failures; complete status/version/audit/review/notice/reservation snapshots remain unchanged. |
| AC-027.7.6 | Integration — Boundary / Regression | Reservation wins lock; waiting status change sees the allocation, retains it and creates its review. |
| AC-027.8.1 | Integration — Happy path | Per-unit monotonic versions record actual staff IDs/names, trimmed note, old/new status and server time. |
| AC-027.8.2 | Integration — Negative | Even Technical Support cannot directly update status/version, rewrite/delete audit or call private review helper. |
| AC-027.8.3 | Integration — Negative | All other roles and signed-out claims cannot manage status/history; unrelated Coordinator cannot read affected reviews. |
| AC-027.8.4 | Integration — Boundary / Regression | Simultaneous staff edits accept one version and preserve exactly one audit. |
| AC-027.8.5 | Integration — Regression | Replay 0105 with populated status history/reservations/reviews/notices; saved snapshots remain identical. |

Locations: `equipment_status_fixture.sql`, `equipment_status.sql`,
`equipment_status_races.sh`, `run_equipment_status.sh` under `backend/supabase/tests/`.
Status cases/races also run in the existing historical and conversion runners.
These 18 cases bring the US27 automated case count to 29 (eight frontend, 21 SQL).
PR3 component/service cases remain unallocated.

PR2 verification: focused status suite and populated replay passed; historical,
upgrade and fresh-order database gates all exited 0, including new and existing
concurrency checks. Logs: `docs/test-evidence/us27/pr2/`. No frontend code changed;
the previous PR1 frontend totals are not presented as a new PR2 run.

PR1 manual groups in chat were confirmed passed by Jaydon on 23 October; shared sheet
updates are not claimed. New status UI/manual checks remain pending PR3/deployment.
Initial status-race failure was a malformed UUID in the fixture, corrected without a
product-code change. Do not record it as a product defect.

Next unused IDs: AC-027.1.6, .2.3, .3.2, .4.4, .5.4, .6.5, .7.7, .8.6.

Verification: all eight frontend cases passed in the full 1,524-test run (175 files);
build/typecheck and lint passed. All three grouped SQL cases passed in the final
focused, historical, quarter-hour upgrade and fresh migration-order runs, including
the reserved-unit/snapshot extension. All database gates exited 0 and existing
concurrency checks passed. Logs: `docs/test-evidence/us27/`. The initial approval
interruption was resolved; no new product defect was found. CI and manual checks
remain pending. Shared evidence-sheet rows are supplied through chat.
