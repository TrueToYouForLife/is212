# US24 return coverage — 4 November 2026
- Branch `us24-return-coverage`, base3350c20 (PR182 merged). Jaydon owns Git/PR/merge.
  Only tests/docs/evidence; no application/database/migration/config/exclusion changes.
- Three new component IDs .1.19–21: unsaved close/reopen, valid nullable display fields,
  late reload after unmount. Strengthen .1.12 malformed-response cases. US24 now40 IDs:
  23 database, six unit,11 component. No new manual/SQL pass or product defect found.
- Focused14 before/17 after (two files); full1,744/223, lint/build/typecheck pass.
  Global98.24% statements/lines,92.29% branches,95.83% functions. View/service all100%;
  form100% statements/lines/functions,93.75% branches (26,30,40; reasons in story doc).
- Two disposable-copy regression probes detected; restored17 tests pass. First late
  reload probe stopped for missing .env; synthetic localhost config fixed its harness,
  retaining the network guard. No real credentials copied or app defect claimed.
- Sheet rows30/31/33 percentages/locations/progress/notes saved and verified: view/service
  Retested - 100%; form Justification needed. US24 summary uses story-tag counts.
  Status/catalogue components deferred to US27;
  event requirement catalogue service's US24 mapping needs review (original Nicole US8).

# US7 review-component coverage — 4 November 2026
- Branch `us7-review-component-coverage`, base4d47053 (PR181 merged). Jaydon owns Git.
  Three new component IDs .3.12/.9.24/.13.32; catalogue285. Notes/provisional outcomes,
  late event-switch responses and reload/reset with fresh save versions are tested.
- Focused42/five files before,45/six after; full1,741/223, lint/build/typecheck pass.
  Global98.24% statements/lines,92.04% branches,95.71% functions. Two disposable-copy
  regressions detected; restored15 tests pass. No product/DB/migration/exclusion edits.
- Initial build rejected new fixture number attendance/null notes; corrected to text/
  empty strings and retested. Retained initial failure is a fixture error, not app defect.
- Summary100% statements/lines,95.65% branches; field100% statements/lines,90.90% branches;
  form96.96% statements/lines,93.54% branches; panel97.95% statements/lines,100% branches.
  All functions100%. Exact remaining reasons in docs/us7-review-component-coverage.md.
- Sheet rows42/43/46/50 percentages, locations and justifications saved/verified;
  all Justification needed. US41 arrangement-review files remain separate. No new
  manual, SQL, deployed-environment, commit, push, PR or remote CI result claimed.

# US7 review-data coverage — 4 November 2026
- Branch `us7-review-data-coverage`, base 13309ef (US17 PR180 merged). Jaydon owns Git.
  Only tests/docs/evidence; no application, database, migration or coverage exclusions.
- Five new unit cases: .3.8–11 and .9.23; strengthen .3.1 mapping with actual structured
  arrays, correcting a historical text fixture. US7 catalogue282 IDs. No product defect.
- Focused43/three files before,48/four after; full1,738/222, lint and build/typecheck pass.
  Global98.23% statements/lines,91.94% branches,95.71% functions. Two disposable-copy
  regression probes detected; restored37 tests pass. No SQL/manual/RLS pass claimed.
- Target files all100% statements/lines/functions. Branches: display96.42% (47),
  query70% (35,39–41,43–46), save93.10% (24–25). Exact contract-based reasons in
  docs/us7-review-data-coverage.md; retain safeguards, no impossible null mocks.
- Worklist rows41/47/49 refreshed and verified saved to Drive: percentages/locations,
  Justification needed and exact contract reasons. US7 summary uses story-tag formulas.
  Remaining four US7 review components, US41 arrangement files and other owners'
  allocations stay outside this portion. No commit, push, PR or remote CI claimed.

# US17 assignment coverage — 4 November 2026
- Branch `us17-assignment-coverage`, base 41fa44a (US1 PR179 and upstream PR178 merged).
  Jaydon owns Git/PR/merge. No product, migration, shared DB, configuration or exclusions
  changed. Story-by-story: US17 only; US36/38 tests are unchanged regression coverage.
- New .1.13, .2.10–19 and .3.3–4: eight unit/five component cases. Components keep
  assignment service real, mock Supabase RPC only. US17 catalogue now66 source IDs.
- Focused before9/two files; expanded22/five files pass. Full1,733/221 files, lint and
  build (includes typecheck) pass. Overall98.14% statements/lines,91.80% branches,
  95.71% functions includes upstream coverage work; do not attribute all gains here.
- Service, card and queue all100%; form100% statements/lines/functions,95.45% branches. Retain line23
  early-return guard: ordinary clicks cannot submit disabled/invalid/pending controls.
  Do not force submit events just to claim100%; record reason pending team review.
- Three disposable-copy regression probes detected; restored11 new tests pass. No
  genuine product defect found. Probe-checker Error/AssertionError mismatch corrected,
  not an app failure. Evidence docs/test-evidence/us17/assignment-coverage/.
- Shared coverage worklist rows 24–25/29/45 refreshed and verified saved to Drive:
  service/card/queue Retested - 100%; form Justification needed. Jaydon takes the two
  additional card/queue files (32 total). US17 summary uses story-tag formulas
  (11 mapped files, six with gaps across all owners). No new manual or SQL pass claimed.

# US1 draft coverage — 4 November 2026
- Branch `us1-draft-coverage`, base 3edab5b. Jaydon owns Git/PR/merge; rebalanced
  coverage work only. No app/migration/shared-data changes or manual pass claimed.
- Strengthened AC-001.3.1 and .4.27–28; new .4.35–37 test date-boundary conversion,
  copied requirement arrays and stale list response after account switch. US1 86 IDs.
- Focused before 53 / four files, after 56 / four files; full 1,701 / 211 files passed.
  Coverage 96.52% statements/lines,91.30% branches,94.76% functions. Lint and build
  (includes typecheck) passed. Full suite has unrelated React act/blocked-network
  warnings; no real network calls or failing assertions. Build has chunk-size warning.
- draftFormValues all100%; MyDrafts branches/functions100%. Retain four defensive
  fallbacks under current service/schema/collection contracts; no impossible mocks,
  coverage exclusions or removed safeguards. Evidence docs/test-evidence/us1/draft-coverage/.
- No product defect found. No SQL gate needed for this test/docs-only portion.

# US41 arrangement-review loading fix — 3 November 2026
- Branch `us41-arrangement-review-loading-fix`, base 292c9af; Jaydon handles Git/PR/merge.
- Confirmed product bug: post-0099 unqualified venue_bookings embed returns HTTP300
  PGRST201. Specify arrangement_review_flags_venue_booking_id_fkey; keep replacement
  FK/audit, alias/schema, RLS and resolution behaviour unchanged. No migration.
- Strengthened .1.5 unit contract; .1.13–15 new real HTTP integration groups, distinct
  original/replacement names, history/equipment/empty/RLS. Standalone runner uses all
  current migrations, PostgreSQL17/PostgREST12.2.12 and synthetic Auth/JWTs; cleans own
  containers/network, no shared data. CI database job adds Node22 and this gate.
- API final, 12 targeted / five files, full 1,698 / 213 files, typecheck/lint/build pass.
  Coverage96.50% statements/lines,91.29% branches,94.76% functions. No broad SQL rerun.
- Four actual read-only UI groups passed on localhost with coordinator@test.com and
  configured shared backend: EVT0025 empty+refresh, EVT0020 venue reason+refresh,
  EVT0012 mixed reasons/history, EVT0015 assigned-other protected panel hidden.
  No shared writes, resolution saves, team message, sheet edit or remote CI claim.
- Evidence docs/test-evidence/us41/loading-fix/ includes real API error and screenshots.
  Yuanlong says defect already logged; number/approval not verified. Update existing
  entry, no duplicate. OwnerJaydon; actual authenticated identity retained in evidence.
- US41 now25 IDs; index includes backend.mjs. Global2892/45 remains: main removed three
  flag IDs(US12two/US19one), APIadds3. US48 safety-stage manual workflow remains pending.

# US7 reply-validation restoration — 3 November 2026
- Branch `us7-reply-validation-tests`, base 215f847 (PR170 merged, Jaydon confirmed).
  Jaydon handles commits/push/PR/merge. No application/migration/shared deployment changes.
- Replaced duplicate 27 review executions in dedicated reply file with 11 allocated
  AC-007.7.37–47 cases against the real reply validator. Original review file unchanged.
  Group related negative/boundary inputs; no manufactured product defect or new IDs.
- Focused 57 / five files and full 1,701 / 213 files passed; typecheck/lint/build passed.
  Runtime count falls by 16 because duplicated 27 are replaced by 11 distinct cases.
  Coverage 96.50% lines/statements, 91.29% branches, 94.76% functions; reply helper 100%.
- Catalogue US7 now 277 source IDs; global 2,892 / 45 stories. Corrected source links,
  closed missing-case finding, retained historical checkpoints. Evidence:
  docs/test-evidence/us7/reply-validation/README.md. No sheet/manual/remote CI result claimed.
- US48 safety-stage manual acceptance with US45 workflow remains outstanding. Earlier
  PR170 notes below are historical: user confirmed merge and branch deletion.

# PR170 CI verify follow-up
- Branch us41-arrangement-regression-coverage, failed revision c94d336. PR170 attached.
  Both CI DB jobs and push verify passed; pull-request verify failed coverage, with
  multiple alerts in AC-009.9.17 and undefined .then in cancellation context (AC-010.9.6).
- Shared VenueBookingPages.test.tsx: explicit valid-empty replacement/decision-notice
  service mocks; cleanup before mock/timer restoration. Existing .9.17 deliberately
  creates both errors and checks their own alert messages, retaining no-false-empty rule.
  No app/migration/CI configuration changes or new IDs. US9/10/11/49 anchors refreshed;
  original ownership retained. Necessary shared test integration only.
- Full local coverage passed 1,717 tests / 213 files; 96.47% lines/statements,
  91.17% branches, 94.76% functions. Shuffled focused run: 32 tests / three files,
  seed 170; typecheck/lint/build passed. DB not rerun: unchanged and CI DB jobs passed.
- Evidence: docs/test-evidence/us41/regression/ci-verify/README.md. Initial unchanged
  file passed locally, so exact late-effect timing is inferred, not reproduced.
  Test setup correction, not demonstrated product defect; no manual/defect row invented.
  Jaydon must commit/push and await new CI; no remote rerun, comment, push or merge made.

# US41 restored behavioural SQL coverage — 2 November 2026
- Branch `us41-arrangement-regression-coverage`, base 749e6a0. Jaydon handles publication/Git.
  No app, migration or frontend changes, no shared deployment or new manual pass.
- run_arrangement_revalidation.sh invokes the two original SQL files, called by both
  CI DB entry points immediately before the LAST replay check. Canonical layout codes,
  catalogue-backed arrays and actual model-appropriate cell calculators replace old
  free-text fixtures. Null per-booking fields intentionally test event-level fallback.
- Ten old IDs restored, not newly allocated; US41 stays 22 (11 SQL, 11 frontend), global
  2,881. AC-041.1.4 strengthened with exact event/request/revalidation/flag/notice/outbox
  rollback snapshots. Removed unused original snapshots; populated replay stays separate.
- Focused final, historical retest, quarter-hour upgrade and fresh gates exited 0; all
  ten cases plus both .1.3 replay checkpoints passed. Three deliberate DB-function faults
  failed the intended unchanged assertions; subtransactions restored functions/data,
  final full ten-case suite passed. No product defect/TDD or new coverage % claimed.
- Test helper initially sorted revalidations by nonexistent id; corrected to change_request_id.
  First preservation probe hit the existing protected-slot guard; final allocation-date
  probe reaches .1.2. Both are test setup/injected-fault issues, not product defects.
- Evidence: docs/test-evidence/us41/regression/README.md. Refresh ten existing overview
  evidence refs; no duplicate IDs, manual/defect rows or Automated Test Case Runs edits.
  The old SQL runner gap is closed. US7 reply-validation restoration remains next.

# US41 replay preservation test — 2 November 2026
- Branch `us41-replay-preservation-test`, base 917ecb4; Jaydon handles commits/push/PR/merge.
  No app or migration edits, shared deployment, new frontend run or manual pass.
- AC-041.1.3: self-contained populated fixture, two independent venue reasons plus
  equipment, one open and two resolved via actual Coordinator RPC. Compare every flag/
  notice column in both directions after 0052 and after 0053 replay; fixture guards
  prevent empty/RLS-hidden passes. Run as admin for full-table comparison.
- New run_arrangement_review_replay.sh is LAST in historical and conversion runners:
  historical function replays must not precede current-schema tests. Standalone fresh
  schema, historical, quarter-hour upgrade and fresh gates all exited 0. Four deliberate
  difference probes were detected/rolled back, final comparison passed; not defects/TDD.
- Evidence: docs/test-evidence/us41/replay/README.md. No normal assertion failed.
  Docker stopped/socket sandbox access were environment issues; local runs authorised.
- US41 inventory now 22 IDs (11 SQL/11 frontend), global 2,881 numeric references.
  Separate newly identified gap: arrangement_revalidation.sql and arrangement_layout_capacity.sql
  contain ten older SQL IDs but are not invoked by current runners. Do not claim these
  passed anew; assess/restore legacy fixtures in a separate portion. US7 gap still pending.

# Jaydon test documentation accuracy review — 2 November 2026
- Branch `jaydon-test-documentation-review`, baseline d23ff29 after catalogue closeout
  merged. Documentation only; Jaydon handles Git and publication. No new test runs,
  manual passes, migration, shared deployment or spreadsheet changes claimed.
- Review: docs/jaydon-test-documentation-review.md. Ten stories: US1/7/17/24/27/36/41/42/47/48,
  634 distinct numeric source references. Corrected scenario types, parameter inputs,
  create-vs-update assertions in US1, link-only checks in US36, and US42 UI classifications.
- New static finding: tracked changeRequestReplyValidation.test.ts is byte-identical to
  changeRequestReviewValidation.test.ts; both repeat 27 review-validation cases. Historical
  AC-007.7.37–47 are absent. Record missing dedicated reply coverage, not a product failure
  or extra distinct cases; no test source deleted/changed. Restore in a later portion.
- US41 AC-041.1.3 remains next bounded test portion: snapshots exist, comparison absent.
  Inspect replay order and add a populated preservation assertion, then use disposable DB.
- US48 safety-stage manual results remain unreported; 0116 SQL checks do not establish
  US45 invalidation/resubmission with the safety workflow enabled. Historical reports retained.

# Test-case documentation closeout — 2 November 2026
- Branch `jaydon-test-documentation-closeout`; documentation-only. No product, migration
  or test-source changes. Jaydon handles commits/push/PR/merge; no shared sheet edits.
- Canonical catalogues and audit: docs/test-cases/README.md. US1 (83 IDs), US7 (266)
  and US17 (53) now fully mapped; complete missing team catalogues and US31 rows too.
  US45 spec moved to docs/test-cases/US45_test_cases.md; existing records retained.
- Trace all 2,880 numeric source IDs across 45 stories to their own catalogue; this is
  source traceability, not runtime counts/pass/coverage or a newer Jira AC signoff.
  Shared/legacy/untagged test titles are in Shared_test_cases.md without invented IDs.
- Existing UI-rendering rows labelled unit are corrected to component. SQL/shell cases
  are integration, mocked services/pure helpers are unit. No manual pass/defect invented.
- US41 AC-041.1.3 remains a separate follow-up: replay snapshots exist, comparison/test
  is absent; explicitly not a passing source case. US48 legacy .2.6 is dependency-only.
- No source IDs in this checkout for US25/28/30/35/39/40/50/51/53; owners must verify mapping,
  not infer a pass or an unimplemented story. Existing manual Not run records preserved.
- US48 compatibility PR161 is merged on this baseline; team reported shared migrations
  applied through 0122. New-stage manual acceptance remains unreported here.

# US48 safety-stage compatibility — 29 October 2026
- Branch `us48-safety-stage-replacements`; Jaydon claimed 0116 and reopened US48 in Jira.
  Agreed scope: Awaiting safety review and In preparation only. No US27 changes,
  Safety changes requested extension, US45 transition or safety-settings change.
- 0116 updates four current 0099/0102 RPC definitions: get/propose/decide replacement
  and shared approve_venue_booking. Only stage predicates change; ordinary approvals
  still require Approved/Planning, except a checked staff-owned replacement link.
- Preserve quarter-hour buffers, per-booking requirements, source/decision consent,
  original until atomic success, selective blocked/retired resolution and independent reviews.
  No event/safety history writes. Notify Jeremiah about the shared approval function;
  he owns re-review integration. No team messages/shared deployment/Git publication.
- Existing UI contracts unchanged; no frontend source changes. 17 new grouped SQL
  cases (six race executions across three IDs); results: docs/test-evidence/us48/safety-stages/.
  Focused, historical, quarter-hour upgrade and fresh gates all passed (exit 0).
  Fixed a missing organisation in synthetic test data before the focused retest.
  Initial Docker startup failure was environment-only; no product defect established.
- Historical runner skips 0116; quarter-hour upgrade/fresh gates install it last after
  deliberate old-function replays. New-stage manual checks/CI/shared deployment pending.
- Backed up invalid duplicate Git ref to /tmp/is212-git-ref-backup-0116/ and fast-forwarded
  this clean branch to origin/main 8f14a1b (US24 PR160 merged). No commit or push made.

# US24 PR2 — return inspection UI, updated 29 October 2026
- Branch `us24-return-inspection-ui`; PR1 merged and 0112 applied (Jaydon confirmed).
  No new migration. Jaydon owns commits, PRs, merges, shared deployment/manual checks.
- Technical Support-only `/equipment/returns` with Out/Pending checks/History. Use the
  server's date-based allocation lists; no checkout action, scheduling job, physical
  timestamps/location changes or extra availability block. General US27 editor unchanged.
- Form requires explicit findings; issue descriptions/status choices, forced Unavailable
  for Missing, keep-current default for No issues including legacy values. One checked
  RPC saves atomically. Success closes/refreshes; Missing remains pending for follow-up.
- Pending blocks duplicates/edit/close/reload/tab/list changes. Failed/stale/uncertain
  outcomes retain inputs and lock retry until explicit reload; never silently replace
  displayed consent. Obsolete/failed reload preserves notes and stays locked. Role/account
  changes unmount and ignore late responses. Backend remains permission enforcement.
- Pure validation in equipmentReturnValidation.ts; only equipmentReturnService.ts calls
  Supabase, validates list/receipt identities/versions and maps safe errors. Reuse status
  labels/targets/date formatting. No client actor/time/unit substitution.
- Fourteen new tests: six unit, eight component; total 37 grouped US24 cases including
  PR1's 23 SQL cases. Targeted 14 cases passed; full frontend run 1,590 tests / 189
  files passed. Coverage 96.27% lines/statements, 90.84% branches, 95.18% functions.
  Lint and typecheck passed. Build passed in a source/lockfile-matched disposable copy
  after the repo build failed on an OS file-read timeout (no modules transformed).
  Original dependencies/config unchanged; no new DB run claimed for frontend-only work.
  Initial test startup hit OS file-read error in PostCSS; sampled typecheck waited in
  file read. Root cause unconfirmed, not a product defect; no project dependency/config edits.
- Docs/manual guide: docs/us24-return-inspections.md; tests: docs/test-cases/US24_test_cases.md.
  Logs: docs/test-evidence/us24/pr2/. Jaydon reported all eight chat manual groups passed
  on 29 October; details/limits: docs/test-evidence/us24/manual-results.md. Initial API
  404 PGRST202 came from an incomplete 0112 paste; Jaydon reran the complete migration
  and confirmed its objects exist. Deployment/setup issue, not a product defect.
  CI, frontend merge/deployment and sheet update remain unclaimed. Provide sheet rows
  in chat; never repository TSV/Automated Test Case Runs.

# US24 PR1 — return inspection backend, 27 October 2026
- Branch `us24-return-inspection-backend`; Jaydon claimed 0112. Code-first; no frontend
  edits, shared deployment or manual passes. Jaydon owns commits, PRs and merges.
- Out is the saved collection-to-return window inclusive in Singapore time. Pending
  checks starts the following day. No physical checkout/return timestamp or location
  writes, early reservation release, scheduler or automatic rebooking. Pending checks
  alone does not block future reservations; preserve US14's windows/US27 status rules.
- Inspect actual allocation/unit, record findings and reuse set_equipment_status in one
  transaction, with type-first locks and displayed source consent. Missing -> Unavailable
  stays pending; follow-up is append-only. Good retains status by default, including legacy
  values; explicit changes require a reason. Retain findings even if status is unchanged.
- Existing defect reports retained; browser report writes closed. New inspection history
  and RPCs are Technical Support-only. Stale/date/status/allocation changes require reload.
- Cases/contracts/manual guide: docs/us24-return-inspections.md and docs/test-cases/US24_test_cases.md.
  Final focused run: 23 grouped SQL cases passed, including four races and populated replay.
  Historical/upgrade/fresh gates passed (upgrade/fresh preceded the last two test additions;
  final focused run verifies those). No product defect found. A test-assembly/count mismatch
  was corrected; not a product defect. Logs: docs/test-evidence/us24/pr1/. Sheet rows belong in chat.
- Shared review: Yuan Long for allocation/report contracts; Jeremiah for the previously
  identified US27 safety-stage notification eligibility gap, not expanded by this portion.
- PR2 will add Out/Pending checks/History UI only after Jaydon reviews/merges this portion
  and applies 0112. No new frontend/coverage run claimed for backend-only changes.

# US27 documentation closeout — 23 October 2026
- Branch `us27-docs-closeout`; implementation merged in #142/#143/#144.
  Jaydon confirmed 0104 and 0105 applied, PR1 manual groups, status-flow checks and
  subsequent auto-close check passed. Manual results: docs/test-evidence/us27/manual-results.md.
- All eight ACs implemented; 40 grouped automated cases (19 frontend, 21 SQL).
  Latest full frontend run: 1,535 tests / 177 files; coverage 96.12% lines/statements,
  90.60% branches, 95.22% functions. This run preceded the auto-close refinement;
  afterward 13 targeted tests / two files, typecheck/build and lint passed.
  PR2 focused, historical, upgrade/fresh database gates, races and replay passed.
- One genuine product defect, AC-027.2.3, fixed and retested; failure log retained.
  Fixture/matcher mistakes and slow dependency reads are not product defects.
- Shared evidence-sheet update and Jira transition remain with Jaydon. Sheet rows
  belong in chat, never TSV files. No new migration or application changes for closeout;
  no full-suite rerun claimed. Deployment timestamp/account IDs and delivered email
  were not supplied; optional manual scenarios are not inferred.
- Earlier US27 sections below are historical checkpoints, superseded by this status.

# US27 PR3 — status UI, 23 October 2026
- Branch `us27-equipment-status-ui`; PR2 merged and 0105 applied (Jaydon confirmed).
  No new migration. User owns Git, deployment and manual verification. Code-first.
- Technical Support gets Manage status in the existing catalogue. Load current version
  and history via 0105 RPC; four explicit targets and required reason. Coordinator read-only.
- Pending saves disable edits/reload/close; selected panel blocks other management opens
  and catalogue refresh. Failed saves keep note/target, lock retry, require explicit reload.
  No silent consent refresh. Confirmed saves (including no-op) automatically close the
  panel and refresh stock, retaining filters/success feedback; reopening loads fresh history.
- History displays stored actor/note and Singapore time. Role/account changes unmount
  management and ignore late responses. Backend remains permission enforcement.
- Eleven new cases passed; full suite 1,535 tests / 177 files, coverage 96.12% lines/
  statements, 90.60% branches, 95.22% functions. Typecheck/lint/build passed.
- Genuine AC-027.2.3 defect fixed: fast batched catalogue refresh left the panel stale.
  Initially fixed with a refresh revision key; later superseded by Jaydon's requested
  auto-close after success. Reopening loads fresh status/history/version. Failure evidence
  in docs/test-evidence/us27/pr3/. Same regression case extended for auto-close/unit switch.
- Early slow dependency reads/missing Promise definitions cleared on retry; environment
  cause unconfirmed, not a product defect. No lockfile/config/dependency edits for this PR.
  Jaydon confirmed status-flow manual checks and the subsequent auto-close refinement
  passed on 23 October. No exact account/fixture IDs or delivered-email result supplied.
  Sheet update, PR merge and deployed frontend verification remain with Jaydon.
  Evidence-sheet rows belong in chat, never TSV files. No temporary catalogue seed added.

# US27 PR2 — status backend, 23 October 2026
- Branch `us27-equipment-status-backend`; Jaydon claimed 0105. Code-first; user owns
  commits, PRs and deployment. No frontend edits or status UI in this portion.
- 0105 adds versioned get/set_equipment_status RPCs, required notes and actual staff/time
  audit. Preserve legacy retired/missing values; new target Unavailable stored unavailable.
- Share US14 type lock before unit lock/re-read. Close direct browser status/version
  updates while preserving unrelated unit edits. Audit has no browser write permissions.
- New equipment_status_change_id review source and equipment_non_operational reason reuse
  existing Coordinator indicators/resolution. Retain all reservations and independent reasons.
  Upcoming Approved/Planning/Confirmed reserved/checked-out arrangements qualify; exact-start,
  past/closed and returned/cancelled do not. Unassigned events flag without requester notices.
- Existing arrangement_review preferences govern in-app copies and typed queued email via
  US33 helpers. This producer adds default email; metadata records email support. No old
  review/notification helper overrides. Flag this shared detail to Jeremiah for PR review.
- Focused 18-case status suite, three races and populated 0105 replay passed. Final DB
  historical/upgrade/fresh gates all exited 0. Malformed UUID in initial race fixture was corrected;
  no product defect demonstrated. No new full frontend-suite result claimed for backend work.
- PR1 merged #142; Jaydon confirmed 0104 applied and all seven chat manual groups passed.
  Do not infer offline/zero-stock-specific checks or claim sheet updated. 0105 not deployed.
- Next portion: Technical Support status form/history using loaded version; Coordinator
  catalogue remains read-only. Do not implement PR3 until Jaydon reviews this portion.

# US27 PR1 — equipment catalogue, 23 October 2026
- Branch `us27-equipment-catalogue`; Jaydon claimed 0104. Code-first; user handles Git,
  PRs and shared deployment. AC-027.1–4 only; status writes/reviews/audit are later portions.
- Reuse 0019 types/units and type.notes description; catalogue RPC is restricted to
  Technical Support/Coordinator. No new direct unit permissions or creation/deletion UI.
- Global counts include zero-unit types; usable = Operational even if reserved for a date.
  Three unit filters intersect; retired/missing retain reasons under Unavailable.
- Preserve US13/14 routes, Organiser type choices and US42 summaries. Next status portion
  must share the per-type reservation lock, close direct status-write bypasses, retain
  allocations/independent reasons, and use current shared notification helpers/preferences.
- Cases/manual steps: docs/us27-equipment-catalogue.md, docs/test-cases/US27_test_cases.md.
  Sheet rows belong in chat, never repo TSV. No manual pass/deployment claimed.
- Frontend final: 175 files / 1,524 tests passed, coverage 96.07% lines/statements,
  90.53% branches, 95.13% functions; build/typecheck and lint passed. Final focused,
  historical, quarter-hour upgrade and fresh-order DB gates exited 0, including
  reserved-unit/snapshot assertions and existing concurrency regressions. Accidental
  Docker approval interruption resolved; CI, shared deployment and manual checks pending.
  No product defect demonstrated; unsupported test matcher corrected in test code.

# US48 documentation closeout — 21 October 2026
- Branch `us48-docs-closeout`; implementation merged in #127/#128. PR #128 shows
  four checks passed. 0099 applied (Jaydon confirmed); 0100-dependent workflow manually
  passed per Jaydon. No separate deployment timestamp/operator supplied.
- Jaydon confirmed all nine manual-checklist steps passed; no manual defect reported.
  Source: docs/test-evidence/us48/manual-results.md. Exact fixture/account IDs omitted
  because they were not provided. Email delivery is not claimed.
- Replacement UI shows reasons/Needs replacement, prefills the complete event interval
  and requirements, then reuses US20 proposal/staff decisions. No event writes or target holds.
  Failed sends preserve the note and require reload; displayed consent versions are never refreshed silently.
- Jaydon explicitly chose one continuous start date/time → end date/time period, overriding
  the older daily-slot interpretation. Endpoints are Singapore time, quarter-hour aligned,
  half-open. Full day uses 00:00–24:00; end-date 00:00 is also available.
- 0100 retains legacy daily slots/gaps without backfill; new period RPCs and exact closure
  checks cover preview, holds, approval, review, buffer/event revalidation and release triggers.
  Existing date/slot RPCs remain supported. Deploy 0100 before this frontend.
- Shared US12/US47 contract change: notify owners before shared deployment. Bookings/events
  remain intact; overlapping bookings receive reviews. Emails are queued, not claimed delivered.
- Final frontend: 173 files / 1,516 tests passed; build (includes typecheck) and lint passed.
  Coverage: 95.73% lines/statements, 90.46% branches, 95.05% functions; scope unchanged.
  Direct US48 coverage: 20 backend and 11 frontend cases. Shared blocking/replacement/
  buffer tests remain regression coverage, excluded from the US48-only sheet pack.
  Misallocated AC-048.2.6 retains its source/log ID but is excluded from US48 AC mapping.
- Historical, populated upgrade and fresh-order disposable Docker database gates passed.
  0100 and 0099 replay preservation, exact endpoints, derived buffers and concurrent blocks checked.
- Genuine fixed product defect AC-048.2.3 retains failure evidence: failed option loading
  falsely kept Searching wording. Wrong review-store assertions, test API/label mistakes,
  and temporary-file lint race are test/tool issues, not product defects.
- All six ACs have implementation and passing automated/manual evidence. Jaydon
  confirmed the evidence sheet is up to date. US48 scope: 31 overview cases, eight
  manual groups and one automated defect. Provide future sheet rows directly in
  chat; never add TSV files to the repository.
- Only documentation PR merge and Jira transition remain with Jaydon. Do not claim
  those complete. Docs-only closeout: no new full-suite pass claimed.
  See docs/us48-venue-replacement.md and docs/test-cases/US48_test_cases.md.
  Next US48 IDs: .1.5/.2.7/.3.10/.4.2/.5.3/.6.11.

# US48 PR1 backend checkpoint — 21 October 2026
- Branch `us48-replacement-integrity`; Jaydon claimed migration 0099. Local only;
  user handles commits, PRs, merges and shared deployment. Code-first, then tests.
- Reuse US20 replacement RPCs/table for blocked and retired originals. Preserve
  events and originals until approval commits; resolve only blocked/retired reviews
  with authenticated staff and replacement-booking attribution. Other reasons stay open.
- Shared contracts: both review stores, US12 cancellation trigger and normal approval.
  Upcoming Confirmed events are allowed only through checked replacement approval;
  event status/details stay unchanged and ordinary booking eligibility stays unchanged.
- Requires 0075/0098. Source hashes include review reasons; pre-0099 pending proposals
  may need a freshly loaded rejection/withdrawal and resubmission, never silent consent.
- Twenty grouped SQL cases and three races passed; focused, historical, upgrade and
  fresh-order DB runners exit 0. Existing frontend compatibility: 22 tests / 3 files.
  No new full frontend/build/lint/coverage pass claimed; no frontend product edits.
- No product defect demonstrated; fixture/RLS setup mistakes were corrected. Expected
  refusals and injected review-write failure are not defects or TDD evidence.
- PR2 must add reasons/search integration and Needs replacement UI. US48 remains
  incomplete; deployment, manual checks, CI and shared evidence-sheet updates pending.
- Story/docs: docs/us48-venue-replacement.md, docs/test-cases/US48_test_cases.md and
  docs/test-evidence/us48/. Next IDs: .1.2, .2.1, .3.8, .4.2, .5.2, .6.11.

# US47 — implementation merged; documentation closeout, 21 October 2026
- Working branch `us47-docs-closeout`. Implementation PRs merged; 0074/0075/0098 applied to shared Supabase. Manual settings and readability checks passed; shared overview/manual/automated-defect evidence updated.
- Staff configure per-venue setup/turnaround independently in Manage venues → Edit, as non-negative multiples of 15, default zero. Use authorised settings RPCs; preserve the direct-write guard.
- New holds/approval and search/suitability/calendars include effective occupancy. Preserve saved reservations/history; settings conflicts create reviews rather than automatic cancellation or movement.
- Coordinator/Venue Staff notices use existing channel preferences; all Venue Staff are recipients because there is no per-venue staff assignment. Email queuing is tested; delivered email is not claimed.
- Recorded implementation verification: 170 frontend files / 1,500 tests; typecheck, lint, build and historical/upgrade/fresh DB suites passed. No new full-suite pass is claimed for docs-only changes.
- Fixed SQL save defect AC-047.1.3 and earlier .2.17 defect retain failure evidence. Intentional forced breaks and expected concurrency refusals are not discovered defects.
- Conversion runners include 0098/replay/settings checks. Historical runner deliberately skips 0075/0098. Do not edit/reapply deployed migrations to change behaviour; claim a new migration if a defect requires a follow-up.
- AC mapping: docs/us47-venue-buffers.md. Cases/evidence: docs/test-cases/US47_test_cases.md and docs/test-evidence/us47/. Automated runs remain in GitHub Actions; do not populate the spreadsheet run tab.
- User owns commits, pushes, PR, shared deployment and Jira transition.

# US42 merged implementation (18 October 2026)
- Venue PR #103 and equipment PR #106 merged; local main updated to dd07c40 and equipment branch deleted.
- Claimed migration 0071 adds owner-only equipment read: name, requested/reserved quantities, existing status. Pending review stays distinct; no staff notes or unit allocations exposed.
- Four SQL cases .2.1–2 and .3.5–6 passed with full DB suite; log docs/test-evidence/us42/database-equipment.log. Code-first, no TDD. Next IDs .1.7, .2.7, .3.8.
- Full frontend integration: 143 files / 1,318 tests passed; build/typecheck and lint passed. Logs saved under docs/test-evidence/us42/.
- Service and equipment panel implemented; cases .2.3–6/.3.7 passed. Existing .3.4 now checks both panels. User handles commits/pushes/PRs. Shared sheet updated: 19 overview cases (nine new equipment cases and extended .3.4), seven manual passes. Equipment statuses/quantities, refresh, unrelated-organiser denial and privacy manually passed on 18 October. Equipment PR #106 merged. Coverage review remains outstanding; no coverage percentage is claimed.

# ConnectSphere Event Planning System — Project Context

## US42 slice 1: organiser venue arrangements (historical checkpoint, 18 October 2026)
- Branch `us42-venue-arrangements`; code-first. Migration 0068 was claimed and applied to shared Supabase.
- Owner-only RPC returns confirmed venue bookings and actual saved event/buffer cells. No staff notes, reviewer details or direct table access are added.
- Organiser panel sits below Request details and supports Singapore dates, midnight, empty/error states and refresh. Equipment (AC-042.2) is covered by the later checkpoint above.
- Ten new cases: four SQL and six frontend. Full DB suite passed; frontend 139 files / 1,293 tests passed; build/typecheck and lint passed.
- Manual checks passed: approved booking visibility, pending/empty behaviour and unrelated-organiser denial. Other manual scenarios remain unverified.
- Story: `docs/us42-confirmed-arrangements.md`; cases: `docs/test-cases/US42_test_cases.md`; logs: `docs/test-evidence/us42/`. Next IDs: .1.7, .2.1, .3.5.
- Shared sheet updated with ten automated cases and three passed manual checks. AC-042.1.4 forced-break caught read errors incorrectly returning an empty success; exact service restored, all three service tests passed. Logs saved; no test changes or product defect. Venue PR #103 subsequently merged; coverage measurement remains unclaimed. Commits, pushes and merges are handled manually; pause between logical portions.

## US41 completed within agreed scope
- 0053 fixes stale structured-layout precedence after an approved layout change.
  Subsequent coordinator saves confirm the structured layout. AC-041.3.3 tests both
  sequences. PR #90 merged; Jaydon confirmed 0053 deployed and manual retest passed.
  Leave deployed migrations unchanged.
- Backend, flags/indicators and resolution/history merged in PRs #86–88. 0052 applied,
  confirmed by Jaydon. Documentation close-out merged in PR #89.
- Approved significant changes create per-arrangement reasons; no booking/claim/allocation
  mutation. Current coordinator resolves each reason with a mandatory note. History retained.
- AC4 scope: produce arrangement_review_notifications with recipient/event/flag/reason.
  Shared notification UI/email are owned elsewhere. No existing reader or outbox bridge
  consumes these rows; document the handoff, do not claim notification delivery.
- Uses existing slot-based venue_review_cells and date-based equipment_free_units.
  Fifteen-minute and per-booking/session requirement changes remain shared dependencies.
- 22 US41 cases: eleven DB, eleven frontend. Latest implementation verification: full DB
  runner passed; frontend 1,003 pass/one TODO; lint/build passed. Close-out does not rerun tests.
- Jaydon confirmed indicators, one venue with multiple reasons counted once, equipment
  flag count 1→2, resolution 2→1 and history persistence. Do not infer unreported manual tests.
- Three fixed defects: stale layout capacity after successive approvals (0053, .3.3); missing coordinator_id in detail read (fixed, regression .1.10); asynchronous
  callback assertion in .1.7 (waitFor fix). Deliberate mutation logs .1.7/.6.3 are not defects.
- docs/us41-arrangement-revalidation.md holds AC review, notification handoff and evidence.
  Shared overview and defect records include .3.3; Jaydon confirmed the final manual pass.
  Record that pass in the sheet and finish Jira close-out; never mark delivery complete.

## Architecture and workflow diagrams
- `docs/architecture/README.md` records sources and modelling decisions; `index.html`
  is the local viewer. C1–C3 and Workflow Parts 1–3 describe the whole-project target,
  including planned features. Do not infer implementation completion from them.
- Edit `docs/architecture/generate.py` and regenerate the six SVGs with
  `python3 docs/architecture/generate.py`. Keep viewer links and the guide aligned.
  Retain only the three agreed workflow parts; do not regenerate superseded versions.

## US36 active-event overview (completed, merged)
- Reuses CoordinatorAssignmentQueue/Card and 0041 workload RPC; no migration.
- All active events, including submitted unassigned events, appear once in one
  Active events list. Unassigned + Submitted filters reproduce the US17 queue.
- Cards show status and a detail link; workload summary includes zero counts and
  disappears on read error. Existing reassignment refreshes both data sources.
- Five code-first UI cases: AC-036.1.1, .2.1, .3.1, .4.1, .5.1. Final local run on
  11 October 2026: 871 passed/one existing TODO across 91 files; lint/build passed.
  The TODO is not a passing test. AC-036.1.1 forced-break failed for the
  missing unassigned planning event; exact implementation restored and test passed.
  Logs: docs/test-evidence/us36/. No broken code retained and no test changes.
- Jaydon confirmed the overview/link/reassignment/role UI checks and final
  combined-list/filter retest passed on 11 October. Both implementation PRs merged
  with passing CI. Filters combine coordinator
  (including Unassigned) and active status across the combined list; Reset restores all.
  Workload counts stay independent; selections persist on data refresh. The
  combined-list refinement removes the separate Unassigned requests heading.
  US17 .1.10/.2.9 assertions follow the filtered queue and saved assignee; .3.2
  expects the Active events heading. No extra cases for the combined-list refinement.
- Shared sheet updated: five US36 overview cases and five manual records, all
  ownership fields Jaydon. Heading confusion was found manually and is recorded
  with its fix under Manual Testing; no genuine automated defect was added.
  Automated runs are evidenced by GitHub Actions, not the spreadsheet run tab.
  No TDD record for US36. See docs/us36-active-events.md. User handles Git/Jira.

- US17 coordinator Requests view groups readable requests by coordinatorId:
  Assigned to me first, then Other event requests, preserving service order.
  RequestListItem's optional assignedToYou label is presentation only. No RLS or
  query changes. AC-017.4.6 covers grouping, refreshed assignments and empty states.

## US17 equipment handover follow-up (9 October 2026)
- 0048 changes legacy equipment booking/line coordinator policies to use
  is_assigned_event_coordinator; requested_by remains historical attribution.
- Direct coordinator updates change decision status only. The SECURITY INVOKER
  guard checks current_user so existing SECURITY DEFINER equipment requirement and
  reservation functions retain their checked internal updates.
- AC-017.4.4 is the unchanged handover TDD test; AC-017.4.5 is additional regression
  coverage. Full SQL suite passed locally; CI and equipment-owner review are pending.
- No shared database deployment yet. Keep separate from the 0047 venue-access PR.

## What this is
University project (SMU IS212). Event planning and venue booking for an events company.
Roles: Event Organiser, Event Coordinator, Venue Staff, Technical Support Staff, Attendee.

## Stack
React 18 + TypeScript + Vite · Tailwind · React Hook Form + Zod
Supabase (PostgreSQL + Auth + RLS) · Vitest + React Testing Library · GitHub Actions

## Repository layout
- frontend/ is the React app. Run every npm command from there.
- backend/supabase/migrations/ holds the database schema, RLS policies and triggers.
  There is no API server: the browser talks to Supabase directly, so the database is the
  backend.

## Architecture rules — follow these without being asked
- Feature folders: frontend/src/features/<feature>/ with types.ts, validation.ts,
  <x>Service.ts, components/, __tests__/
- validation.ts holds PURE functions only. No React, no Supabase, no I/O.
- Only <x>Service.ts talks to Supabase. Components never import the Supabase client.
- Business rules are validated in the client (UX) AND constrained in the database
  (integrity). This is deliberate defence in depth.
- Time intervals are half-open [start, end). Touching intervals do not overlap.
- Never use NOT NULL on a field a draft may legitimately omit; use a conditional CHECK
  keyed on status instead.

## Testing
- Every test case ID has the form `AC-00X.Y.Z`:
  X = user story number from the backlog (US1-US15, not the Jira SCRUM key),
  Y = acceptance criterion, numbered in Jira bullet order,
  Z = test case number within that criterion (unpadded: .1, .2 ... .12).
  Example: test('AC-001.2.1: accepts an empty draft', ...)
- Current story numbers: US1 Save Draft (SCRUM-8), US2 Submit Event Request (SCRUM-7),
  US3 View Event Request Status (SCRUM-24), US4 Review and Approve/Reject/Return
  (SCRUM-9), US6 Organiser Requesting Changes (SCRUM-11), US7 Coordinator Reviewing
  Change Requests (SCRUM-12), US13 Record Equipment Requirements (SCRUM-19).
- Z is unique per criterion across the whole story, including parameterised rows and
  tests in different files. Before adding a test, use the next unused Z for that
  criterion (see README allocations); never reuse or renumber an existing ID.
- Within a file, Z must increase top to bottom for each criterion. Group tests by
  criterion and preserve setup/helper scope when rearranging tests.
- Tests with no backlog story (AC-LIFECYCLE, AC-ROLES) are pending tickets; do not add
  more ad-hoc prefixes.
- Every story needs at least one boundary, conflict or failure test.
- We must reach high coverage and be able to trace acceptance criteria to tests.
- CI provides placeholder Supabase URL/key values separately for the Test and Build
  steps. These let the client initialise during imports; they do not connect to a real
  database. US4 ReviewActions tests mock the review function but import the real service
  for its messages. Keep mocked tests from making real network calls; live integration
  tests require a separate test environment, fixtures and cleanup.

## Roles and authorisation
- Roles live in public.profiles.role, never in auth.users. Values: organiser, coordinator, coordinator_lead,
  operations_manager, venue_staff, tech_support, attendee.
- Read the caller's role in SQL with public.current_user_role(). It is SECURITY DEFINER on
  purpose: a policy on profiles that queries profiles recurses infinitely.
- Roles are assigned by an administrator, never chosen by the user. A trigger blocks a
  signed-in user from changing their own role.
- Hiding UI from a role is a courtesy. The RLS policy is the control. Every role-gated
  screen must have a matching policy, or it is not actually protected.
- There is no in-app role switcher. dev_set_my_role() was dropped in 0014; test each role
  with its own account (README "Test accounts"). Do not reintroduce a self-service role change.

## Organiser status presentation
- Use status/organiserStatusLabel.ts for event badges and submission results: submitted
  and under_review display In review; submitted with a nonblank review note displays
  Clarification required. Pass organiserView on shared badges/panels only for organisers.
- Internal states remain unchanged. US4 submitted-request decisions use the atomic
  review_submitted_event RPC from 0012 instead of a Start review button. It runs the
  existing transitions and triggers together; older under_review rows retain their
  existing path. Apply 0012 before deploying this UI. Change-request submitted
  displays In review via changeRequestDisplay.ts. Replies will return to that same label.

## Event status values
draft, submitted, under_review, approved, planning, confirmed, completed, cancelled,
rejected. Review transitions belong in eventReviewService. Explicit draft submission
belongs in eventService so validated details and status change atomically on the same
owned Draft row. Both paths use expected-status filters and database transition triggers.
Draft saves in eventDraftService must never change an existing request's status.

## Change-request database baseline
- Shared Supabase used `event_change_requests_status_valid`, not just the fresh
  baseline's `event_change_requests_status_check`. Apply `0011` after `0010` to
  consolidate these into the six-status rule. Without it, clarification and partial
  approval fail even with the current RPC. The runner reproduces the mismatch and
  checks the fix; the reply increment brings the runner to 86 database checks. Never rerun 0007 after later migrations
  as a deployment shortcut: it restores the older, broader access policies.
- `0007_event_change_requests.sql` captures the shared US6 table, policies and timestamp
  trigger. It preserves existing rows and does not implement US7 review decisions.
- US7 is Event Coordinator Reviewing Change Requests; its tests follow the standard
  `AC-00X.Y.Z` format with criteria in the agreed Jira order.
- Follow-up work must cover assigned-coordinator access, per-change decisions and
  reasons, and atomic application of accepted changes. Existing request policies are
  a baseline, not proof of secure review or withdrawal. See README for known gaps.
- Both `0005` migrations precede `0006`; their duplicate version prefix needs resolving
  before relying on CLI migration discovery. Do not silently renumber applied files.
- `changeRequestReviewValidation.ts` is pure US7 review preparation.
  Decisions cover each proposed field once; rejected fields require explanations and
  clarification_requested fields require questions. Any unresolved field makes all
  approvals provisional: no event changes apply until every field is resolved.
  Do not treat prepared values as a validated event or bypass database permissions.
  README records the 27 validator test IDs using the supplied Jira AC order.
- `changeRequestReviewService.ts` calls that validator and the existing review RPC;
  the coordinator detail page now uses it through ChangeRequestReviewPanel/Form.
  Pass the exact event `updated_at` shown to the reviewer,
  never refresh it just before saving. Only decisions/notes go to the RPC, not proposed
  values or reviewer identity. Do not automatically retry a lost review response.
  Its 23 mocked tests continue the existing AC allocations; see README. Choose the
  RPC payload by the presence of decisions, not by status: field-level clarification
  also uses action=decide. Legacy whole-request action=clarify remains supported.
- `0008_change_request_review.sql` adds coordinator assignment and the atomic review
  RPC. Originally Operations Managers assigned; 0038 moves assignment to Coordinator Lead.
  Only the assigned coordinator reviews a
  pending request with a matching event updated_at. Values come from the stored
  proposal. Submitted event details cannot be edited directly by the browser;
  US4 status transitions and US1 draft edits still work. Never apply this migration
  silently to shared Supabase. Notifications/revalidation are pending.
- `0010_change_request_field_clarification.sql` replaces the review RPC to save mixed
  provisional decisions/questions without changing the event. It still accepts only
  submitted requests. Organiser replies/resubmission are implemented in 0013, and the reply UI/history are now connected. The browser loop still needs live
  verification; never bypass the reply operation with direct status updates.
  reviewed_at/by record the review action even if clarification is still outstanding.
  Per-field questions are in field_decisions.note, not the legacy review_note.
- `changeRequestReviewQueryService.ts` loads the event, exact version and embedded
  requests together, restricted to the signed-in assigned coordinator. Review forms
  do not poll: manual reload discards unsaved choices; failed saves require reloading.
  ChangeRequestSummary exposes per-field questions/reasons and provisional decisions
  to the organiser. Status wording is shared in changeRequestDisplay.ts.
  See `docs/us7-review-ui.md` for all 37 new test cases and the file-by-file change log.
  Existing US6 confirmed-event eligibility remains a recorded follow-up.
- Database checks live in `backend/supabase/tests/`; run
  `bash backend/supabase/tests/run_change_request_review.sh` with Docker running. Synthetic
  fixtures and Auth helpers are for the disposable container only, not shared Supabase.
  82 US7 SQL case IDs continue the unit-test allocations (see README), with four
  additional cross-story regression checks. These tests are separate from Vitest/CI.

## Review decisions and email (US4)
- `0009_review_decisions.sql`: `event_review_decisions` is the retained AC-004.5 record and
  `notification_outbox` queues AC-004.4 emails. Both are written only by the AFTER UPDATE
  trigger `record_event_review_decision`, using auth.uid() as the actor. Never add a
  client insert path or a write policy to either table.
- The decision log is staff-only (coordinator, operations_manager); reviewer identity stays
  internal. The outbox is service-role only.
- Emails are sent by the Edge Function `backend/supabase/functions/send-review-notifications`
  (Deno, not part of the Vite build). Provider keys live in Supabase secrets, never `VITE_`.
- Database checks: `backend/supabase/tests/review_decisions_test.sql`, disposable databases only.

## US17 slice 1 (current assignment rules)

- Latest: slice 4 merged in PR #72; Jaydon confirmed CI green and 0046 deployed.
  Treat 0046 as immutable. Follow-up venue handover is local-only pending Nicole's
  agreement: US11 AC8 original-placer wording conflicts with US17 AC4/SCRUM-160.
  Jaydon claimed 0047, now implemented locally but not deployed. AC-017.4.2 failed
  because the old coordinator could submit a reassigned hold; unchanged test now
  passes with the full SQL suite. Frontend: 864 passed, one TODO. Existing unassigned
  booking behaviour from 0036 is preserved via requester fallback only when no
  coordinator is assigned. Venue Staff/expired-hold cleanup remain unchanged.
  Jaydon confirmed database green CI. Frontend AC-017.4.3 is now red: new assignee
  received an empty booking list. Jaydon confirmed red CI, then service filters
  changed: assigned-event inner join for listing, RLS for inherited submit/release.
  Unchanged .4.3 now passes; full frontend 865 passed/one TODO and full SQL passed.
  Four existing venue test expectations updated for the proposed rule; no new
  tests in green. Next unused AC4 ID is .4. No extra regression cases. Nicole's
  approval, green CI and live acceptance remain pending; 0047 is not deployed.

- Slice 4 green checkpoint: 0046 (claimed by Jaydon, not deployed) adds recipient
  assignment notifications and queues mail through the unchanged US4 sender. Trigger
  runs from assignment-history insertion in the same transaction. Both channels default
  on; admin-only per-type settings, recipient/current-event RLS, no browser writes.
  AC-017.5.1 passes unchanged after its red/green cycle. AC-017.5.2–3 are additional
  regression tests: reassignment/no-op/refused changes and recipient/current-assignment
  RLS/write restrictions. Both passed immediately, not TDD cycles. AC-017.5.4–5 cover
  channel settings and 0046 replay; full SQL suite passed after correcting test syntax,
  with no feature changes. These are regression coverage too. Live delivery remains
  unverified. Do not claim a shared inbox. Next AC5 test ID: .6.
  Continue TDD for US17 at Jaydon's explicit request and flag any additional regression tests.

- `0038_coordinator_lead_assignment.sql` accepts coordinator_lead and grants SELECT on
  non-draft events. The existing assignment RPC and guard now require that role.
- Do not convert existing Manager accounts automatically or grant Leads unrelated
  venue/equipment management rights. Admin provisioning remains required.
- Keep later migration replacements after historical replay in the database runner:
  replaying 0008 alone restores obsolete Manager-only assignment.
- Test IDs: AC-017.1.1 app, .1.2-9 and .2.1-7 SQL. Next IDs: .1.10 and .2.8.
  Red-green cycles: .1.1, .1.2, .1.9, .2.1. Other cases are additional coverage,
  not retrospectively claimed TDD. See docs/us17-assignment.md.
- Slice 1 has no queue UI, assignment history, notifications or terminal-event
  reassignment rules. Those are future increments; do not mark the whole story complete.

## House style
- US17 slice 3 in progress: Leads use /requests for the unassigned submitted queue.
  listEventRequests loads coordinator_id; only explicit null denotes unassigned.
  AC-017.1.10 covers queue presentation; AC-017.2.9 covers selection/save failure/retry.
  coordinatorAssignmentService.ts alone calls dropdown/assignment RPCs. Apply 0041 before
  live dropdown testing (deployment unconfirmed); AC-017.2.8 covers its Lead-only counts.
  AC-017.3.2 covers reassignment with retry and closed-event controls excluded. Active
  counts and reassignment UI exclude draft/completed/cancelled/rejected. Live checks remain.
  Jaydon confirmed 0039 deployed on 6 October 2026: do not edit that migration further.
- US17 slice 2: 0039 blocks completed/cancelled reassignment and guards coordinator
  event updates using the current assignee. US4 review fixtures must have an assignment.
  Assignment history is trigger-written, Lead-readable, with no browser writes/backfill.
  Reapply 0039 after the runner's historical 0008/0038 replay. Three SQL TDD cases:
  AC-017.3.1, .4.1, .6.1. See docs/us17-assignment.md for deployment and open scope.
- Shared event date/time displays use Asia/Singapore explicitly in formatters.ts;
  do not depend on the browser or CI machine timezone.
- No `any`. Prefer explicit types.
- Comment *why*, not *what*. We are examined orally on our design decisions.
- Small components. Extract when a file passes ~150 lines.

## Out of scope for the first release
Reporting, analytics, recurring events, multi-session events, dashboards.

## Organiser clarification reply increment
- `0013_change_request_replies.sql` follows 0011; 0012 is reserved in another PR and
  is not a dependency. Apply 0013 before deploying the readers of review_version.
  Jaydon reported applying 0013 to shared Supabase on 27 September. Live UI checks remain.
- Only the owning organiser may call reply_to_change_request. All outstanding field
  questions require answers; legacy whole-request questions accept a note. Answers
  cannot edit proposed values. The request returns to submitted, the event stays unchanged.
- review_version increments on every request update. Pass the displayed version to
  reply and review calls; never refresh it silently before writing. Requests with reply
  history cannot be reviewed by an old client that omits the version.
- reply_history retains questions/answers/actors/times per reply round. It is not yet
  the complete US7 activity log. Reply form/history UI are connected; live verification remains pending.
- See docs/us7-reply-preparation.md for each changed file and new test case.
  Reply validation: AC-007.7.37–47; reply service: .48–56; SQL replies: .57–66,
  plus AC-007.2.32–35, .8.3, .9.17, .13.7–8. Review-service tests: .5.39–40.

- Reply UI: ChangeRequestReplyForm is owner-only in ChangeRequestList, for clarification
  status only. No polling/focus refresh in that list while typing. Explicit reload discards
  text; failed writes retain text and lock retry until reload. Other status panels still poll.
- ChangeRequestReplyHistory is shared through ChangeRequestSummary by organiser and
  coordinator. Query services select reply_history and map missing fixture values to [].
  Do not replace retained questions with the latest field_decisions when rendering history.
- UI tests: AC-007.7.67–74 form, .75–77 list; AC-007.13.9 coordinator panel,
  .13.10–11 shared history. Existing AC-007.3.1 also verifies history mapping.
  349 app tests; database suite unchanged at 86. See docs/us7-reply-preparation.md.

## Significant-change display (US7 AC11)
- classifyChangeRequest in changeRequestSignificance.ts is pure and derived from the
  stored proposal keys. Significant: proposedStart, proposedEnd, expectedAttendance,
  layoutPreference, accessibilityRequirements, equipmentRequirements. Layout/accessibility
  represent venue requirements in the current model. Other supported fields alone are ordinary.
- A blank optional requirement still counts as a change. No free-text inference, size
  threshold or comparison against current event values. Historical outcome does not change
  the classification. Show the affected fields through ChangeRequestSignificance in the
  shared request summary, separately from the request status badge.
- This is a UI flag, not an enforcement mechanism or persisted database flag. AC12 must
  derive revalidation needs from accepted fields in the database; do not trust this label.
- Tests AC-007.11.1–10 in changeRequestSignificance.test.ts; .11–13 in
  ChangeRequestSignificance.test.tsx. 368 app tests total; no new SQL tests/migration.
  See docs/us7-significance.md. Notifications, AC12 and complete review audit history remain.

## US7 AC12 revalidation hook
- 0015_change_request_revalidation.sql adds event_change_revalidations, populated by an
  AFTER UPDATE trigger within the existing final-review transaction. Only accepted significant
  fields count. No queue for rejection, ordinary-only approval or provisional clarification.
- Dates/attendance flag both arrangements; layout/accessibility venue only; equipment fields
  equipment only. Derive from stored decisions/proposal, not a client classification flag.
- Assigned coordinator and Operations Manager have RLS SELECT; browser writes are revoked.
  One row per request. Queue failure rolls back event and review. No historical backfill.
- This is a pending integration hook, not real booking/equipment checks. No completion API,
  worker or automatic lifecycle transition. Downstream owners must implement those separately.
- Jaydon applied 0015 to shared Supabase and reported a successful equipment-approval
  revalidation record on 27 September. Other live paths still need verification.
  Tests AC-007.12.1–18 in change_request_revalidation.sql,
  .19 replay in runner. See docs/us7-revalidation.md. Notifications/full review audit remain.

## US7 notification trigger (AC1 / SCRUM-54)
- 0016_change_request_notifications.sql is trigger-only by Jaydon's scope decision. No
  shared notification UI or new sender. It records assigned-coordinator notifications
  on initial submission and clarification reply -> submitted; unique request/version/recipient.
- change_request_notification_settings controls this type's channels: in-app true, email
  false by default. Only admin configuration; no browser write grants. Email uses the
  existing notification_outbox and unchanged send-review-notifications worker.
- RLS limits in-app reads to recipient + current assigned coordinator. No recipient
  details/proposals in the generic email body; queued mail is not rerouted on reassignment.
- Unassigned requests create no notification; US17 later assignment/backlog remains a
  dependency. No existing-data backfill. Record failure rolls back submission.
- AC-007.1.1–17 in change_request_notifications.sql; .18 migration replay in runner.
  No live emails sent; migration not applied to shared Supabase. UI/delivery evidence
  is still required for AC1, separately from this trigger subtask. See docs/us7-notification-trigger.md.

## US7 retained review history (latest increment)
- 0017 records future review actions in event_change_review_history in the same transaction
  as the review. Snapshot proposal, decisions, actor name/ID and time; never derive history
  from mutable current request fields. No historical backfill or browser writes.
- Staff identity history is restricted to current assigned coordinator / Operations Manager.
  Only coordinator query embeds it; organiser query and shared summary do not expose it.
- ChangeRequestReviewHistory displays entries below each coordinator request summary,
  newest version first. Clarification decisions are explicitly provisional.
- Apply 0017 before updated coordinator queries. Not applied to shared Supabase this round.
- AC-007.13.12–26 SQL/runner; .27–31 UI/query. See docs/us7-review-history.md.
- Progress correction to older sections: reply flow and revalidation were user-tested;
  0016 was applied and email queuing reported by Jaydon. Actual notification delivery is
  still unverified. Organiser notifications are deferred; do not reconfigure the shared sender.

## US13 equipment requirements (SCRUM-19)
- 0024_event_equipment_requirements.sql follows 0023 and does not modify 0019's tables.
  Requirements are the Coordinator's list; reserving is US14 through 0019 booking lines and
  allocations, linked back by booking_line_id. Recording must never create a booking or
  allocation (AC-013.5). Applied to shared Supabase on 3 October; there, 0019 had no
  equipment_types policies, so types_select_staff was re-created from 0019 (see docs).
- Only the assigned coordinator (events.coordinator_id) writes, and only while the event is
  approved/planning/confirmed (trigger, errcode 22000). Column grants let the browser write
  only type_id, quantity, technical_notes and essential; never grant status, booking_line_id,
  created_by or event_id. Reads: assigned coordinator and all tech_support.
- A type/quantity change on a reserved/partially_reserved line resets it to pending_review
  and cancels its 'reserved' allocations; deletion cancels them too. Cancel, never delete;
  checked_out/returned stay. Notes/essential edits keep the reservation.
- Notifications: trigger-written equipment_requirement_notifications, one per tech_support
  user, for added/changed/removed Coordinator fields only. No browser write path.
- equipmentRequirementService.ts is the only Supabase access; equipmentRows.ts maps rows.
  Tests AC-013.1–6: 57 app tests, 56 SQL checks in equipment_requirements.sql. Totals: 446 app
  tests; 203 database checks. Next IDs and the US14 contract: docs/us13-equipment-requirements.md.

## US14 equipment reservations (SCRUM-20)
- 0025_equipment_reservations.sql follows 0024 and builds on 0019's units, booking lines and
  allocations; never add a parallel catalogue. Not yet applied to shared Supabase.
- Reserve only through reserve_equipment (rpc). Never check availability in the browser and
  write separately. Technical Support's direct writes on allocations, lines and bookings were
  removed (agreed with Nicole); keep it that way. Every SECURITY DEFINER function must call
  require_tech_support() and set search_path = ''.
- Windows are per unit, in whole Singapore days: collection = first day - 1, minus one more
  day when the unit is not at an approved (confirmed) venue booking of the event; through
  the return day, which defaults to the last day and can't be earlier. Only operational units
  count. Per-type advisory lock (lock_equipment_type) for every reserve and return-date change.
- Outcome notices reuse equipment_requirement_notifications (coordinator recipient) plus
  notification_outbox; channels in equipment_notification_settings. One per requirement outcome.
- Tests AC-014.1–13: 22 app tests, 82 SQL checks in equipment_reservations.sql. In SQL tests,
  run actions as separate statements before asserting (a statement can't see its own function
  calls' writes). Totals: 468 app tests; 285 database checks. See docs/us14-equipment-reservations.md.

## US29 attendee sign-up (SCRUM-227)
- 0042_attendee_self_signup.sql replaces handle_new_user: every new account is an Attendee,
  whatever the sign-up metadata says. Never read a role from raw_user_meta_data. Not yet
  applied to shared Supabase.
- SQL fixtures: inserting into auth.users now creates an attendee. Set organiser (and every
  other role) explicitly as administrator after the insert, as five existing files now do.
- No organiser sign-up (team decision, 7 October): organisers and staff are seed data, with
  the role set by an administrator. Do not reintroduce a role or organiser choice on /signup.
- Supabase "Confirm email" stays on: no session until the link is clicked. Sign-up sets
  emailRedirectTo to /events/open, which must be listed in the dashboard's Redirect URLs.
  A duplicate shows as a user with no identities; signUp reports it (team accepted the
  account-enumeration trade-off).
- /signup (React Hook Form + Zod) replaced the sign-in page's in-page sign-up mode.
  /events/open became the US15 open-events list (see the US15 section).
- Tests AC-029.1–4: 29 app tests, 8 SQL checks in attendee_signup.sql plus a 0042 replay in
  the runner; 3 manual. Organiser-request IDs (.3.2, .3.3, .3.7–.3.12, .3.14) are withdrawn,
  never reuse them; next AC-029.3 ID is .3.18. Totals: 793 app tests; 418 database checks.
  See docs/test-cases/US29_test_cases.md.

## US15 register for a confirmed event (SCRUM-22)
- 0043_event_registrations.sql follows 0042. Not yet applied to shared Supabase.
- "Registration enabled" is the existing events.registration_required (US52 adds the
  coordinator toggle later). Open = confirmed + registration_required + proposed_start in the
  future, defined once in event_is_open_for_registration and enforced in register_for_event.
- Register only through register_for_event (rpc): caller must be an Attendee (42501); event
  must be open (22000); answers checked (22023, same phone rule as the form: 8-15 digits).
  Browsers have no insert/update/delete on event_registrations; owners SELECT their rows only.
- One active registration per attendee and event: partial unique index where status =
  'registered' (23505). 'withdrawn' is allowed for US23, which must withdraw through its own
  function and may let the person register again.
- Attendees never read events, venues or venue_bookings directly: list_open_events,
  get_open_event and list_my_registrations return public fields only. Venue = confirmed
  bookings only. Do not add an Attendee policy on events (RLS cannot hide columns).
- Confirmation email: AFTER INSERT trigger queues notification_outbox in the same transaction
  (existing US4 sender, unchanged). Queue failure rolls the registration back.
- events.registration_prerequisites is shown to Attendees; no edit screen yet (US52).
- Tests AC-015.1-7: 36 app tests, 34 SQL cases (44 checks) in event_registrations.sql, which
  must stay after equipment_reservations.sql (reuses pg_temp.us14_race). Totals: 831 app
  tests; 462 database checks. Next IDs: AC-015.6.13, AC-015.7.12.
- US29 Home defect (8 October): Attendees get their own Home (Browse events, My registrations).
  Tests AC-029.4.11-12 and AC-015.7.11 in pages/__tests__/SignedInHome.test.tsx. See docs/test-cases/US15_test_cases.md.

## US16 join event waiting list (17 October 2026)
- 0058 (table, join/leave/accept, replaces register_for_event and get_open_event), 0059 (expiry also runs
  when the event page or My registrations is read; a lapsed accept returns null, not an error), 0060
  (Coordinator override, queue_key ordering), 0062 (expiry timer) and 0061 (Coordinator names, US17 AC4).
  0058 to 0060 are applied to shared Supabase: never edit them. 0061 and 0062 are not applied yet.
- Capacity is events.expected_attendance only (team decision); there is no second capacity number. Places
  left = capacity - registrations - unexpired offers. While anyone is waiting, direct registration is refused
  (53000) so nobody jumps the queue.
- One advisory lock per event (waitlist_lock) serialises every waiting-list path; lock order is registration
  or entry row, then event row, then that lock. A call that raises rolls back any expiry it recorded, which is
  why reads clear overdue offers and accept returns null for a lapsed offer.
- No offers in the last 24 hours before the start, none while registration is off or the event is not
  Confirmed, and an offer never outlasts the event start (team proposals, to confirm).
- Emails use notification_outbox as before. The sender needs a caller: a pg_cron job `send-notifications`
  calls the Edge Function every minute (set up by hand in the dashboard, not in the repo) and 0062 schedules
  `expire-waitlist-offers`. pg_cron and pg_net must be enabled; the test database has neither.
- Tests: 123 AC-016 cases (62 SQL, 61 app); see docs/test-cases/US16_test_cases.md. The team dropped TDD:
  code was written first. Seven manual cases are not yet run. Next IDs: AC-016.1.20, .2.47, .3.29, .4.26,
  .5.13. Coordinator names: AC-017.4.7 to .25, next .4.26 (docs/us17-assignment.md).
