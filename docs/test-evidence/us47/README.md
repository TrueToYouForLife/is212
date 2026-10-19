# US47 foundation evidence — 19 October 2026

Owner: Jaydon. Branch: `us47-venue-buffer-settings`.

- [foundation-database.log](foundation-database.log): full disposable PostgreSQL suite, exit 0, including six US47 foundation cases and existing regression/concurrency checks.
- Command: `bash backend/supabase/tests/run_change_request_review.sh`.
- Shell syntax and whitespace checks passed.
- Concurrent loser errors are expected where the subsequent PASS assertions confirm them.
- No frontend code changed, so frontend tests were not rerun for this portion.
- This is code-first verification, not a TDD cycle or forced-break record.
- Shared Supabase was not modified. PR/CI, deployment and shared-sheet updates remain pending.

## Draft 0075 conversion checkpoint

- [conversion-database.log](conversion-database.log): standalone disposable conversion runner exited 0; AC-047.2.3–5 passed.
- Command: `bash backend/supabase/tests/run_venue_time_conversion.sh`.
- Tests populated legacy state and replay; not a full application regression run.
- Draft remains outside the migration sequence. No deployment or browser checks.

## Draft 0075 calculation and block checkpoint

- [calculations-database.log](calculations-database.log): expanded standalone runner exited 0; preservation/replay cases AC-047.2.3–5 and calculation/block cases AC-047.2.6–8 passed.
- Command: `bash backend/supabase/tests/run_venue_time_conversion.sh`.
- Not a full regression pass: old booking/approval callers and frontend still require integration.
- Initial draft helper had an invalid SQL alias; corrected before the successful run. No shared deployment or product-behaviour failure was observed.

## Draft 0075 atomic hold checkpoint

- [holds-database.log](holds-database.log): isolated runner exited 0; AC-047.2.3–10 passed (eight grouped cases).
- New cases cover atomic creation and rejection without partial bookings.
- No frontend, full-regression or concurrency pass claimed. Expiry cleanup and closure refusal need explicit tests.
- No shared deployment, commit or push performed.

## Draft 0075 hold boundary verification

- [hold-boundaries-database.log](hold-boundaries-database.log): runner exited 0; AC-047.2.3–13 passed (11 grouped cases).
- Includes real concurrent database sessions, expiry boundary and setup-only closure refusal.
- SQLSTATE 23505 from the losing concurrent request is intentional negative-test evidence, not a discovered defect.
- Approval/frontend/full regression remain outstanding. No commit, push or shared deployment.

## Draft 0075 approval checkpoint

- [approval-database.log](approval-database.log): isolated runner exited 0, AC-047.2.3–16 passed (14 grouped cases).
- Covers venue-aware review/approval, stale venue settings, conflict rollback and preservation of mismatched converted reservations.
- Includes the existing hold race, whose losing-request error is expected. Approval concurrency is not covered by that race.
- No full regression, frontend pass or shared deployment claimed.

## Incomplete-timing regression

- [AC-047.2.17-incomplete-review-failure.log](AC-047.2.17-incomplete-review-failure.log): runner exited 3 at the review of incomplete timing (preserved original failure).
- Fixture is administrative; normal hold creation cannot create this state. Earlier setup attempts violated existing event constraints and were corrected without production changes.
- This run stopped before concurrency scripts; do not claim they ran in this attempt.

- [AC-047.2.17-incomplete-review-fixed.log](AC-047.2.17-incomplete-review-fixed.log): local fix retest exited 0 on 19 October 2026. Original failing assertion unchanged; all 15 grouped cases passed, including the hold race. Its losing-request SQLSTATE 23505 is expected.
- Fixed locally; no shared deployment, push or PR. Approval concurrency remains pending.

## Approval concurrency verification

- [approval-concurrency-database.log](approval-concurrency-database.log): runner exited 0; all 18 grouped cases AC-047.2.3–20 passed.
- Two approvals, approval versus hold in both orderings, and a concurrent trusted event edit use separate database sessions; saved-state checks passed.
- SQLSTATE 23505 and 40001 are expected negative outcomes. Initial direct-browser-edit fixture was corrected; no product defect found in this checkpoint.
- This supersedes earlier pending approval-concurrency notes. Full application regression and frontend integration remain outstanding.

## Per-venue revalidation checkpoint

- [revalidation-database.log](revalidation-database.log): isolated runner exited 0; 20 grouped cases AC-047.2.3–22 passed.
- Includes the real planning-edit RPC, per-venue setup-only conflicts, reservation preservation and notification-row deduplication.
- No new product defect found. Notification delivery, frontend integration and full regression are not claimed.

## Frontend search checkpoint

- [search-frontend.log](search-frontend.log): 14 tests passed across search service, occupied slots and new search buffer tests.
- [search-typecheck.log](search-typecheck.log): typecheck exited 0.
- [search-lint.log](search-lint.log): lint exited 0.
- Supersedes pending verification of AC-047.2.23–25. AC-047.2.26–27 also passed.
- Search changes require deployment with draft 0075 after remaining frontend integration; no full-suite or browser verification claimed.

## Search selector checkpoint

- [search-selector-tests.log](search-selector-tests.log): 50 tests passed in four files, including AC-047.2.28–29 and legacy slot regressions.
- [search-selector-typecheck.log](search-selector-typecheck.log): exited 0.
- [search-selector-lint.log](search-selector-lint.log): exited 0.
- No full application suite or browser pass claimed. No deployment or commit.

### Suitability checkpoint

- suitability-tests.log: 37 passing service/validation tests, including AC-047.2.30–31.
- suitability-typecheck.log: TypeScript check passed.
- suitability-lint.log: lint passed.
- Focused local verification only; no shared deployment or browser pass claimed.

### Timetable display checkpoint

- timetable-tests.log: 40 passing component/page tests, including AC-047.2.32–33.
- timetable-typecheck.log: TypeScript check passed.
- timetable-lint.log: lint passed.
- Local automated verification only; coordinated browser verification pending.

### Maintenance-block picker checkpoint

- block-picker-tests.log: 56 passing tests across 11 files, including AC-047.2.34–36.
  Contains React act(...) warnings from the passing form tests.
- block-picker-typecheck.log: TypeScript check passed.
- block-picker-lint.log: lint passed.
- Local automated verification only; browser verification pending.

### Booking preview checkpoint

- booking-preview-tests.log: 10 passing tests, including AC-047.2.37–38.
- booking-preview-typecheck.log: TypeScript passed.
- booking-preview-lint.log: lint passed.
- Preview/read checks only. Hold save-path conversion and browser checks pending.

## Final booking-integration verification — 19 October 2026

- integration-frontend.log: full coverage run, 169 files / 1,495 tests passed.
  Reported overall statements/lines 95.67%, branches 90.11%, functions 94.68%.
  Passing tests emit some React act(...) warnings; these remain test-quality follow-up.
- integration-typecheck.log: standalone TypeScript passed.
- integration-lint.log: lint passed.
- integration-build.log: production build (includes TypeScript) passed. Vite reports a bundle-size warning.
- regression-database.log: complete pre-conversion baseline/replay/race suite passed.
- integration-database.log: populated upgrade, replay and concurrency passed, 21 US47 groups.
- fresh-order-database.log: fresh numeric-order migration plus converted-schema tests
  and races passed, 21 US47 groups. Expected refusal errors in race logs are followed
  by PASS assertions and successful runner exits; they are not unexpected defects.
- AC-047.2.23-forced-break.log / AC-047.2.23-restored-pass.log: intentional mutation
  failed and restored implementation passed. Not a defect.

The initial full frontend runs exposed legacy slot fixtures/expectations; the new
atomic-service fixture also needed nullable typing. Corrected as test maintenance,
not logged as product defects. The previously documented .2.17 product defect
retains its separate failure/fix logs. No additional product defect found this turn.

No live Supabase/manual browser pass or GitHub Actions pass is claimed for this branch.
The evidence sheet was not edited in this completion pass. Deploy checklist:
[deployment checklist](../../us47-booking-time-deployment.md).
