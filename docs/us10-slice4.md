# US10 Slice 4: coordinator decision notifications and completion record

## Current checkpoint

Implemented and tested locally on `us10/slice4-coordinator-notifications`.
Base main: `a684271`, including Slice 3 PR #82. Implementation and immediate tests
are together in commit **0b5f257**. Migration **0051** was explicitly reserved by
the user before creation. No shared database deployment, push, PR or merge was
performed for Slice 4. The root untracked `package-lock.json` remains untouched.

The fetch request in this implementation turn was declined. Validation uses the
current checkout; recheck latest main and integration before publication. Do not
claim the branch has been checked against later remote changes.

## Delivered behaviour (AC14)

A real Venue Staff transition from pending to confirmed/rejected records one
immutable in-app notice in the same transaction. It includes venue, event reference,
decision, reason, optional alternative and server reviewer/time. Unique booking
identity prevents duplicate notices. A failed decision leaves no notice; a storage
failure rolls back approval or rejection and their slot changes.

The current assigned coordinator is the recipient. Legacy unassigned requests fall
back to their original requester only if that account is still a coordinator.
No valid coordinator means no notice is created; notices are never routed to an
unrelated role. Recipient RLS additionally checks current assignment, so reassigned
or demoted recipients lose read access. Browser insert/update/delete are refused.

The coordinator's existing **Your venue bookings** page now shows **Booking decision
notifications**, newest first, up to 50. Open the page or use **Refresh notifications**
to read new notices. Errors remain distinct from an empty inbox. Old-session responses
cannot overwrite a newer coordinator's list. No email, background push or historical
backfill is implemented; the story specifies notification without requiring a channel.
Existing Venue Staff submission notifications remain unchanged.

## Verification and saved evidence

| Check | Observed result |
| --- | --- |
| Full frontend coverage run | 101 files passed; 940 tests passed; 1 existing TODO; exit 0 |
| Full disposable PostgreSQL runner | Exit 0; 23 new AC14 database assertions passed |
| New frontend cases | 13 passing service/component cases, including the host page |
| Concurrent decisions | Only the winning outcome generates a single notification |
| Fault injection | Notification storage failure rolls back approval and rejection, preserving appropriate claims |
| Replay | 0051 preserves existing notices and does not generate historical ones |
| Typecheck / lint / build | All exit 0; existing non-failing build chunk-size warning remains |

New notification service and component: **100% lines, statements, branches and
functions**. Across configured frontend feature coverage: **88.94% lines/statements,
87.99% branches, 93.70% functions**. The existing host page is 96.72% lines/statements,
84.21% branches and 100% functions. The overall 100% target is not reached; scope
was not narrowed. SQL is behaviourally tested but not instrumented by Vitest.

Saved under `docs/us10-slice4-evidence`:

- `frontend.log`: full suite and measured coverage.
- `database.log`: complete database suite, including earlier stories and races.
- `notifications-frontend.log`: earlier focused service/component checkpoint (12 cases).
- `typecheck.log`, `lint.log`, `build.log`: quality-check outputs.
- `coverage-summary.json`: machine-readable coverage.
- `frontend-coverage.zip`: full report; extract and open `index.html`.

These are actual assistant-operated local run outputs, normalized to UTF-8 without
terminal colour codes/trailing whitespace. Expected SQL errors in the race log are
successful negative tests checked by the harness; the full runner exited 0.
No real users were notified during testing; database tests used disposable Docker.

The team switched from TDD after Slice 1. Slice 4 uses code-first implementation
with immediate tests, not fabricated RED/GREEN evidence. The story's existing
forced-break evidence remains in `docs/us10-slice2-evidence/AC-010.1.1-forced-break.log`.
This slice's injected storage failure is an automated rollback scenario, not a new
claimed TDD cycle. Owner and future PR fields must be filled by the team.

## Screenshot / record commands (PowerShell, repository root)

```powershell
# 1. Final frontend totals and overall coverage: screenshot these lines.
Select-String -Path .\docs\us10-slice4-evidence\frontend.log -Pattern 'Test Files','Tests  ','All files'

# 2. All 23 AC14 database results, including permissions, rollback and concurrency.
Select-String -Path .\docs\us10-slice4-evidence\database.log -Pattern 'PASS: AC-010.14.'

# 3. Find the code-and-test commit for the evidence sheet.
git log --all --oneline --grep='AC-010.14.1'

# 4. Existing story-level deliberate failure evidence (already saved in Slice 2).
Get-Content -Encoding UTF8 .\docs\us10-slice2-evidence\AC-010.1.1-forced-break.log
```

Retain logs and Git/PR links as evidence; screenshots illustrate them. Put the latest
coverage report/archive in submission folder 3 alongside Nicole's evidence sheet.
CI screenshots must come from the eventual PR: local runs do not prove CI passed.

## AC14 evidence rows

All rows: **US10**, owner **to fill**, PR **not opened**, code/test commit **0b5f257**.
Mocked React/service tests are unit tests, not live browser E2E tests.

| Test ID | Scenario | Type | Scenario class |
| --- | --- | --- | --- |
| AC-010.14.1 | approval records the decision for the assigned coordinator | Integration (database) | Normal |
| AC-010.14.2 | rejection includes reason and alternative for the current assignee | Integration (database) | Normal |
| AC-010.14.3 | a repeated decision produces no duplicate | Integration (database) | Conflict |
| AC-010.14.4 | invalid rejection preserves pending status | Integration (database) | Failure |
| AC-010.14.5 | a refused decision produces no notification | Integration (database) | Failure |
| AC-010.14.6 | recipient can read the delivered rejection | Integration (database) | Normal |
| AC-010.14.7 | the original requester cannot read a reassigned decision | Integration (database) | Failure |
| AC-010.14.8 | unrelated coordinator sees no decision notifications | Integration (database) | Failure |
| AC-010.14.9 | Venue Staff cannot read coordinator notifications | Integration (database) | Failure |
| AC-010.14.10 | anonymous users cannot read notifications | Integration (database) | Failure |
| AC-010.14.11 | recipients cannot fabricate notifications | Integration (database) | Failure |
| AC-010.14.12 | recipients cannot rewrite notifications | Integration (database) | Failure |
| AC-010.14.13 | recipients cannot delete the decision record | Integration (database) | Failure |
| AC-010.14.14 | legacy unassigned request notifies its coordinator requester without inventing an alternative | Integration (database) | Boundary |
| AC-010.14.15 | notification failure refuses the whole approval | Integration (database) | Failure |
| AC-010.14.16 | rollback preserves pending status and leaves no claims or notification | Integration (database) | Failure |
| AC-010.14.17 | reassignment revokes access to the previous recipients historical notification | Integration (database) | Conflict |
| AC-010.14.18 | a recipient who is no longer a coordinator loses access | Integration (database) | Failure |
| AC-010.14.19 | migration replay preserves notices and does not backfill historical decisions | Integration (database) | Boundary |
| AC-010.14.20 | reads at most 50 newest notices with a stable tie-breaker and no browser-chosen recipient | Unit (service) | Boundary |
| AC-010.14.21 | empty successful reads give an empty list | Unit (service) | Boundary |
| AC-010.14.22 | a database error is not an empty successful inbox | Unit (service) | Failure |
| AC-010.14.23 | an interrupted read produces an error without retry | Unit (service) | Failure |
| AC-010.14.24 | coordinator sees approval with venue, event and Singapore decision time | Unit (component) | Normal |
| AC-010.14.25 | rejection includes its reason and suggested alternative | Unit (component) | Normal |
| AC-010.14.26 | a missing reference is explicit and optional alternative is not invented | Unit (component) | Boundary |
| AC-010.14.27 | no decisions has an explicit empty state | Unit (component) | Boundary |
| AC-010.14.28 | a failed read shows an error and manual refresh recovers | Unit (component) | Failure |
| AC-010.14.29 | other roles do not load or display coordinator notifications | Unit (component) | Failure |
| AC-010.14.30 | session loading defers the read | Unit (component) | Boundary |
| AC-010.14.31 | a late response from the previous coordinator cannot replace the current list | Unit (component) | Conflict |
| AC-010.14.32 | the coordinator booking page displays delivered decisions even with no active bookings | Unit (component) | Boundary |
| AC-010.14.33 | a non-coordinator recipient does not receive a decision | Integration (database) | Failure |
| AC-010.14.34 | concurrent decisions deliver only the winning outcome once | Integration (database) | Conflict |
| AC-010.14.35 | notification failure refuses the whole rejection | Integration (database) | Failure |
| AC-010.14.36 | rejected notification failure preserves all held slots and the pending request | Integration (database) | Failure |

## Final US10 acceptance guide (manual checks still pending)

Apply migrations through the team's ordered deployment process, including 0051,
then deploy the matching frontend with `VITE_FEATURE_VENUE_BOOKING=true`.
Use controlled test bookings/accounts. Do not treat pre-existing final bookings as
missing new notifications: historical backfill is intentionally absent.

| Manual check | Expected result | Status |
| --- | --- | --- |
| Venue Staff queue and review | Pending queue; stored details and event/buffer conflicts | Not run on shared Supabase this turn |
| Approve a conflict-free pending request | Confirmed booking, protected cells, event status unchanged; coordinator refresh shows approval | Not run on shared Supabase this turn |
| Reject another request with reason and alternative | Rejected; held slots released; coordinator refresh shows both fields | Not run on shared Supabase this turn |
| Refresh repeatedly after either decision | One notice per booking; no duplicate decision | Not run on shared Supabase this turn |
| Reassigned request | Current assignee receives the notice; previous coordinator cannot read it | Not run on shared Supabase this turn |
| Notification read failure | Error and refresh option; existing booking UI remains independent | Not run on shared Supabase this turn |

For each manual record capture role, test booking/reference, action, expected and
actual result, date, and a screenshot. Record issues honestly; do not mark these
passed from automated results alone.

## Four-slice completion map

| Slice | Scope | Implementation/evidence |
| --- | --- | --- |
| 1 | Rejection, reasons/alternatives, slot release, decision record | docs/us10-slice1.md; historical TDD in docs/us10-test-first.md |
| 2 | Pending queue, timing/requirements, conflict display | docs/us10-slice2.md; 0044; PR #71 merged |
| 3 | Approval, fresh conflict checks, slot protection, finality | docs/us10-slice3.md; 0045; PR #82 merged |
| 4 | Coordinator notifications and final documentation | This file; 0051; locally implemented, publication pending |

All four slices are implemented in this local branch. README now describes the
complete workflow. Publication is still subject to the latest-main check, PR/CI,
merge and shared-environment acceptance. No further US10 feature slice is planned.
