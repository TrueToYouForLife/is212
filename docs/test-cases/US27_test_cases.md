# US27 test cases

Owner: Jaydon. Updated: 23 October 2026. Code-first development.

PR1 covers AC-027.1–4. These 11 grouped cases are requirement-based; related
assertions share one ID. AC-027.5–8 remain for later portions.

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

Manual checks: `docs/us27-equipment-catalogue.md`. All pending Jaydon verification.
No shared evidence-sheet changes or manual results are claimed.

No product defect demonstrated so far. One unsupported Vitest matcher was corrected
in test code. Docker daemon/sandbox startup is an environment issue. Neither is a
product defect or a forced-break result.

Next unused IDs: AC-027.1.6, .2.3, .3.2, .4.4, .5.1, .6.1, .7.1, .8.1.

Verification: all eight frontend cases passed in the full 1,524-test run (175 files);
build/typecheck and lint passed. All three grouped SQL cases passed in the final
focused, historical, quarter-hour upgrade and fresh migration-order runs, including
the reserved-unit/snapshot extension. All database gates exited 0 and existing
concurrency checks passed. Logs: `docs/test-evidence/us27/`. The initial approval
interruption was resolved; no new product defect was found. CI and manual checks
remain pending. Shared evidence-sheet rows are supplied through chat.
