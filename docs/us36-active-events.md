# US36 — View coordinator assignments

Owner: Jaydon

Status: implementation and verification complete; both implementation PRs merged
with passing CI, as confirmed by Jaydon. Jira status changes remain with Jaydon.

## First increment: active-event overview

The Coordinator Lead's existing Requests page now shows status, current coordinator
or Unassigned, and Singapore dates in one Active events list, including submitted
unassigned requests. Unassigned + Submitted filters reproduce the US17 queue.
Each event appears once. Active statuses match the existing workload function:
submitted, under_review, approved, planning and confirmed. Drafts and closed events
are excluded. Withdrawn is not a current EventStatus value; unknown statuses are
also excluded, so a future withdrawn row cannot silently appear as active.

Coordinator workloads use the existing Lead-only list_assignment_coordinators RPC
from migration 0041, including zero counts. A failed read shows an error and retry,
not zero counts. Reassignment refreshes both events and workload totals. Open event
links use the existing request detail route. Assignment controls remain on this
overview; the detail page is not changed.

No database migration, policy change or new permission is introduced. The overview
remains in ReviewRequestsPage's coordinator_lead branch. Existing US17 database
checks cover the Lead-only RPC and assignment permissions. Other roles keep their
existing request views; US36 does not revoke their existing event-read permissions.

## Automated cases

File: frontend/src/features/events/__tests__/CoordinatorActiveEvents.test.tsx

- AC-036.1.1 — Functional/component, happy/negative/boundary: active statuses,
  assigned names, unassigned planning and submitted events, status and Singapore
  date display, exclusion of draft/closed/withdrawn records, no duplicate events,
  and empty list after refresh.
- AC-036.2.1 — Functional/component, happy/negative/boundary: coordinator-only,
  status-only and combined filters; Unassigned across active statuses; no
  matches; reset; unchanged workload totals; no additional reads for filtering;
  refreshed data respects the current selection.
- AC-036.3.1 — Functional/component, happy/negative/boundary: count read failure,
  retry, positive and zero coordinator workloads. Counts are mocked here; their
  database computation remains covered by existing US17 SQL tests.
- AC-036.4.1 — Functional/component, happy path: correct detail URL, reassignment
  service arguments, refreshed coordinator and workload totals. The test verifies
  the link destination, not an end-to-end browser navigation.
- AC-036.5.1 — Functional/component, happy/negative: Lead sees the overview;
  all six other staff/user roles do not render it or call the workload service.

Code-first: implementation preceded the new tests. These are not TDD red/green
cycles. Existing AC-017.3.2 changes its expected section heading from Assigned
events to Active events; its reassignment and error assertions are preserved.
The combined-list refinement also updates AC-017.1.10 to use queue filters and
AC-017.2.9 to check the saved assignee.

## Verification status

11 October 2026, final local verification after the combined-list refinement:

- Full frontend suite: 91 files passed; 871 tests passed, one existing TODO.
  The TODO is not counted as passed. The earlier overview run had 870 passing tests;
  AC-036.2.1 added the final passing case.
- All five US36 tests passed, along with existing US17 tests.
- Lint and production build passed. React act warnings in other test files and the
  build chunk-size warning did not fail these checks.
- Initial test/build stalls stopped occurring after npm ci. The exact cause was
  not established; no source or runner-configuration workaround was required.

Forced-break check completed for AC-036.1.1: temporarily required a coordinator ID
in the active-event filter. The unchanged test failed at the assertion for the
missing Unassigned planning event (exit 1). The component was restored byte-for-byte
and the same test passed (exit 0). Both logs are stored in docs/test-evidence/us36/.
Only this case was selected, so the other three cases existing at that time are
skipped in those logs. The filter case was added in the next increment.
This is deliberate code-first test-sensitivity evidence, not a product defect or
a TDD cycle. The broken implementation is not retained.

Manual UI checks passed, confirmed by Jaydon on 11 October 2026.
Both implementation PRs merged with passing CI, as confirmed by Jaydon.
The shared evidence sheet is updated; see Documentation close-out below.

## Manual checks — passed

Tested by: Jaydon. Date: 11 October 2026. Environment: local development UI.
Results below are Jaydon's reported manual verification, not automated browser runs.

1. Lead overview: active events show coordinator, status and dates; workload
   counts are correct — Pass.
2. Open event: link opens the correct event details — Pass.
3. Reassignment: current coordinator and both workload counts update — Pass.
4. Ordinary coordinator: Lead overview is not displayed — Pass.

## Completion

All five ACs have implementation and test coverage. Both implementation PRs are
merged, final manual checks passed and the requested sheet records are updated.
No remaining US36 implementation task is recorded. This documentation close-out
must still be committed through the team's PR process; Jaydon handles Git and Jira.

## Second increment: assignment filters

Branch: us36-assignment-filters. AC: AC-036.2. Owner: Jaydon.

Coordinator (including Unassigned) and status dropdowns filter events
with AND semantics in one Active events list. Reset restores all active events. Workload totals always reflect
all active assignments, not the filtered subset. Only active statuses are offered;
filters cannot expose drafts or closed events. Filtering uses the loaded data with
no new service calls, migration or permissions. Selections persist through refresh
and reassignment, so events that no longer match disappear from the filtered list.
There is no separate Unassigned requests section. An empty filtered list shows
one no-match message; an empty unfiltered list shows No active events.


Code-first: implemented the filters, then added one grouped AC-036.2.1 case.
The existing four US36 cases and four US17 cases passed in the focused run (9 total).
Full suite: 91 files passed, 871 tests passed and one TODO. Lint and build passed
locally on 11 October 2026 (existing bundle-size warning remains). Existing story-level
forced-break evidence remains applicable; no new forced-break cycle was added.

### Filter manual checks — passed

Jaydon confirmed the initial filters worked, then requested one combined list to
remove ambiguity between unassigned requests and unassigned events. AC-036.2.1
checks the combined list and Reset. AC-017.1.10 now uses Unassigned + Submitted
filters; AC-017.2.9 checks the saved assignee rather than removal from a separate
queue. No new test cases were added for this refinement. Jaydon confirmed the
final combined-list version passed a manual browser retest on 11 October 2026.

1. One Active events heading and no Unassigned requests heading — Pass.
2. Select Unassigned + Submitted to find requests needing first assignment; select
   all active statuses to include unassigned events at later stages too — Pass.
3. Combine coordinator/status filters, check no matches and Reset. Workload totals
   remain unchanged while filtering — Pass.
4. Reassign under the old coordinator filter; the event disappears after refresh
   and appears under the new coordinator filter — Pass.

## Documentation close-out

- Shared Test Case Overview: AC-036.1.1, .2.1, .3.1, .4.1 and .5.1, all Pass.
- Shared Manual Testing: five AC-grouped records dated 11 October 2026, tested by
  Jaydon, all Pass. AC2 retains the confusing section-heading defect and verified fix.
- Defects (Automated Testing): reviewed, no US36 entry added. The heading issue was
  discovered manually; the forced break is deliberate test evidence, not a defect.
- Automated execution evidence lives in GitHub Actions. Per team agreement, do
  not duplicate automated runs in the sheet's Automated Test Case Runs tab.
- Existing forced-break logs stay under docs/test-evidence/us36/. No new TDD
  record is required because US36 followed code-first development.
