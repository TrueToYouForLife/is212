# US10 Slice 3: venue approval

## Latest integration / publication checkpoint

The user requested publishing Slice 3 toward main. Slice 2 PR #71 is now merged.
Main `4a51574` was integrated in `8835e05`; both evidence ignore rules and all
US10/US17 test-runner entries were retained. The branch diff against that main
contains Slice 3 only. Shared Supabase has not been changed.

Post-integration validation: **98 frontend files passed, 927 tests passed,
1 existing TODO**; build (including typecheck) and the full database suite all
exited 0. Saved outputs are `pre-push-frontend.log`, `pre-push-build.log` and
`pre-push-database.log` in the evidence folder. Earlier coverage reports below
remain labelled historical; this latest run used `npm.cmd test` without coverage.
GitHub CI and the PR merge still need to be recorded after branch publication.

```powershell
# Latest frontend results after merging current main.
Select-String -Path .\docs\us10-slice3-evidence\pre-push-frontend.log -Pattern 'Test Files','Tests  '
# Latest database concurrency results (expected refusals are passing negative tests).
Select-String -Path .\docs\us10-slice3-evidence\pre-push-database.log -Pattern 'PASS: AC-010.6.17:', 'PASS: AC-010.12.24:', 'PASS: AC-010.7.4:'
```

## Historical local completion checkpoint

Branch: `us10/slice3-venue-approval`. Migration **0045** was reserved by the user
before creation. Nothing from Slice 3 has been pushed or deployed to shared Supabase.
The unrelated untracked root `package-lock.json` remains untouched.

This branch began at Slice 2 commit `018f73e`. Main subsequently advanced to
`acf39cc`; it was integrated in local merge `008bfa8`. The database-runner conflict
was resolved by keeping both US10 and US17 suites. Final validation below includes
main's coordinator assignment changes and migrations 0046-0049.

Slice 2 is still absent from that fetched main. Merge its PR before the Slice 3 PR
is merged. Check the eventual PR diff: it should show only Slice 3 after its base
contains Slice 2. If Slice 2 is squash/rebase merged, reconcile the branch history
before opening the final PR rather than presenting duplicate Slice 2 changes.

## Delivered behaviour

- AC4/AC5: Venue Staff approve an unchanged pending booking through a single RPC.
  The booking becomes `confirmed`; the overall event status is unchanged.
- AC6/AC7: approval shares the venue lock with blocking, locks the event and request,
  rechecks live blocks, and claims event/setup/turnaround cells atomically. The unique
  slot key resolves competing claims. A refused decision rolls back its new claims.
- AC11: the review returns a version covering booking identity and event requirements.
  Changed timing, attendance, requirements or assignment require reload. No amended
  timing/venue/requirements are accepted by the approval API.
- AC12/AC13: repeated or competing decisions cannot overwrite a final outcome.
  Reviewer and time come from the server; direct browser confirmation is refused.
- Approved claims cannot be released or added to by a coordinator. Existing rejection,
  venue-block and reassignment tests remain passing.
- The review page offers approval only for an eligible pending request. While saving,
  both decision actions and reload are disabled. Failure locks approval retry until
  reload; success reloads the persisted decision.

Migration: `backend/supabase/migrations/0045_venue_booking_approval.sql`.
Apply 0044 then 0045 before deploying this frontend, through the team's deployment
process. Only disposable PostgreSQL containers were used here.

## Development and integration record

The remaining story uses code-first development. The approval transaction and its
safeguards were implemented together because they form one atomic decision; service
and UI tests followed implementation. This was not a separate TDD RED/GREEN cycle
for each AC. Code and its initial tests are together in `2fa3182`.

An older US12 block-removal fixture deleted claims while its booking was still
confirmed. The new protection correctly refused that operation. The fixture now
ends the booking administratively before testing release after a removed block;
the original block-removal assertion is unchanged. The observed failure is saved as
`database-regression-discovery.log`, not labelled as forced-break/TDD evidence.

The story's deliberate forced-break record remains in
`../docs/us10-slice2-evidence/AC-010.1.1-forced-break.log`. It proves detection of an
incorrect queue filter. No artificial failure was introduced in this slice.

## Final validation after integrating main

| Check | Result |
| --- | --- |
| Full frontend coverage run | 96 files passed; 905 tests passed; 1 existing TODO; exit 0 |
| Full disposable database suite | Exit 0, including 32 new Slice 3 assertions |
| Concurrent database sessions | Overlapping approvals: one winner; approval cannot overwrite rejection |
| Migration replay | 0045 replays without changing existing bookings or claims |
| Typecheck, lint, build | All exit 0; existing non-failing build chunk-size warning remains |

Configured frontend coverage: **88.52% lines/statements, 87.34% branches, 93.48%
functions**. Approval service: 100% in all four measures. Approval component:
100% lines/statements/functions, 95.65% branches. Review page: 100%
lines/statements/functions, 92% branches. The 100% target is not fully reached;
some defensive/UI branches and other feature paths remain uncovered. Coverage scope
was not narrowed. SQL behaviour is tested in PostgreSQL and is not instrumented by
Vitest; do not combine its pass count with frontend coverage percentages.

Local passing checks do not prove GitHub CI ran. Record the actual PR URL and CI
results after pushing. Owner is to be filled by the team; no owner or PR is invented.

## Saved evidence and capture commands

`docs/us10-slice3-evidence` contains full final frontend/database logs, typecheck,
lint/build logs, JSON coverage summary, and `frontend-coverage.zip` (extract and
open `index.html`). `*-before-main.log` records the earlier checkpoint; use the
unqualified final logs for submission. Logs are actual tool output normalized to
UTF-8 with terminal colour codes/trailing whitespace removed.

Run these in PowerShell from the repository root; they display saved evidence and
do not rerun tests or change data:

```powershell
# 1. Final frontend totals and aggregate coverage: screenshot these lines.
Select-String -Path .\docs\us10-slice3-evidence\frontend.log -Pattern 'Test Files','Tests  ','All files'

# 2. Database AC results: includes prior slices plus Slice 3; use the mapping below.
Select-String -Path .\docs\us10-slice3-evidence\database.log -Pattern 'PASS: AC-010'

# 3. Actual concurrency evidence: screenshot the three passing race assertions.
Select-String -Path .\docs\us10-slice3-evidence\database.log -Pattern 'PASS: AC-010.6.17:', 'PASS: AC-010.12.24:', 'PASS: AC-010.7.4:'

# 4. Code/test commits: attach these references alongside the results.
git log --oneline --grep='US10' -8

# 5. Earlier deliberate failure for this story (already documented in Slice 2).
Get-Content -Encoding UTF8 .\docs\us10-slice2-evidence\AC-010.1.1-forced-break.log
```

Expected SQL errors `23505` and `40001` appear in the race log: the harness checks
these refusals and final database state before reporting PASS. They are successful
negative tests, not a failed suite. Record the exit-0 suite result with the screenshot.

For Nicole's sheet, all rows below are story **US10**, owner **to fill**, PR **pending**.
Use commit `2fa3182` for initial implementation/tests and the later AC-tagged
validation commit for final additional boundary checks. None are browser E2E tests.
Copy the latest coverage archive/report to submission folder 3 with the evidence sheet.

| AC/test ID | Test name | Type | Scenario |
| --- | --- | --- | --- |
| AC-010.4.18 | staff cannot bypass atomic approval with a direct update | Integration (database) | Failure |
| AC-010.4.19 | organiser cannot approve | Integration (database) | Failure |
| AC-010.4.20 | coordinator cannot approve | Integration (database) | Failure |
| AC-010.4.21 | coordinator_lead cannot approve | Integration (database) | Failure |
| AC-010.4.22 | operations_manager cannot approve | Integration (database) | Failure |
| AC-010.4.23 | tech_support cannot approve | Integration (database) | Failure |
| AC-010.4.24 | attendee cannot approve | Integration (database) | Failure |
| AC-010.4.25 | signed-out caller cannot approve | Integration (database) | Failure |
| AC-010.4.26 | a non-staff user cannot access approval | Unit (component) | Failure |
| AC-010.4.27 | approval waits for session loading | Unit (component) | Failure |
| AC-010.5.14 | unchanged pending booking is approved | Integration (database) | Normal |
| AC-010.5.15 | successful approval persists confirmed status | Integration (database) | Normal |
| AC-010.5.16 | approval sends only booking identity and the reviewed version | Unit (service) | Normal |
| AC-010.5.17 | successful approval notifies the parent and releases its busy state | Unit (component) | Normal |
| AC-010.5.18 | missing booking is unavailable | Integration (database) | Boundary |
| AC-010.5.19 | replaying migration 0045 preserves existing bookings and claims | Integration (database) | Boundary |
| AC-010.5.20 | routed approval reloads the decision and removes both actions | Unit (component) | Normal |
| AC-010.6.12 | a block arriving after review prevents approval | Integration (database) | Conflict |
| AC-010.6.13 | refused approval leaves the decision pending | Integration (database) | Failure |
| AC-010.6.14 | another bookings occupied slot prevents approval | Integration (database) | Conflict |
| AC-010.6.15 | conflicting insert rolls back newly claimed buffers | Integration (database) | Conflict |
| AC-010.6.16 | displayed conflicts prevent approval until resolved and reloaded | Unit (component) | Conflict |
| AC-010.6.17 | concurrent overlapping approvals have only one winner | Integration (database) | Conflict |
| AC-010.6.18 | a venue retired after review cannot be approved | Integration (database) | Failure |
| AC-010.7.2 | approval owns event and both buffer slots | Integration (database) | Normal |
| AC-010.7.3 | requester cannot release approved slots | Integration (database) | Failure |
| AC-010.7.4 | concurrent loser has no claims and winner retains all three cells | Integration (database) | Conflict |
| AC-010.7.5 | existing pending claims are retained without duplicate inserts | Integration (database) | Normal |
| AC-010.11.1 | missing review version is refused | Integration (database) | Boundary |
| AC-010.11.2 | approval leaves all event fields unchanged | Integration (database) | Normal |
| AC-010.11.3 | changed request details require reload | Integration (database) | Failure |
| AC-010.11.4 | missing version is refused without database access | Unit (service) | Boundary |
| AC-010.11.5 | database refusal is surfaced without exposing internal details | Unit (service) | Failure |
| AC-010.11.6 | missing timing or version prevents approval | Unit (component) | Boundary |
| AC-010.11.7 | requirements added after viewing invalidate approval | Integration (database) | Failure |
| AC-010.11.8 | reload supplies a usable version for the changed requirements | Integration (database) | Normal |
| AC-010.11.9 | mismatching claimed cells require resubmission instead of silent amendment | Integration (database) | Failure |
| AC-010.12.18 | repeating the approved decision is refused | Integration (database) | Failure |
| AC-010.12.19 | an unexpected success payload is not treated as approval | Unit (service) | Failure |
| AC-010.12.20 | interrupted approval requires reload and is never retried automatically | Unit (service) | Failure |
| AC-010.12.21 | final booking has no approval action | Unit (component) | Failure |
| AC-010.12.22 | repeated clicks send one request and failure locks retry until reload | Unit (component) | Conflict |
| AC-010.12.23 | leaving the page ignores a late approval response | Unit (component) | Failure |
| AC-010.12.24 | a concurrent rejection cannot be overwritten by approval | Integration (database) | Conflict |
| AC-010.12.25 | even a fresh version cannot approve a final booking twice | Integration (database) | Failure |
| AC-010.13.6 | approval stamps authenticated reviewer and server time | Integration (database) | Normal |

## Next step

Push only on the user's instruction, open a PR, and record green CI before merging.
Slice 4 (coordinator decision notifications and final story documentation) remains.
Claim its migration number separately before creating any new migration.
