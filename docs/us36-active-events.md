# US36 — View coordinator assignments

Owner: Jaydon

## First increment: active-event overview

The Coordinator Lead's existing Requests page now shows status, current coordinator
or Unassigned, and Singapore dates for active events. Submitted unassigned requests
remain in the US17 queue; every other active event appears under Active events.
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
- AC-036.3.1 — Functional/component, happy/negative/boundary: count read failure,
  retry, positive and zero coordinator workloads. Counts are mocked here; their
  database computation remains covered by existing US17 SQL tests.
- AC-036.4.1 — Functional/component, happy path: correct detail URL, reassignment
  service arguments, refreshed coordinator and workload totals. The test verifies
  the link destination, not an end-to-end browser navigation.
- AC-036.5.1 — Functional/component, happy/negative: Lead sees the overview;
  all six other staff/user roles do not render it or call the workload service.

Code-first: implementation preceded the new tests. These are not TDD red/green
cycles. Existing AC-017.3.2 only changes its expected section heading from Assigned
events to Active events; its reassignment and error assertions are preserved.

## Verification status

11 October 2026, local results supplied by Jaydon:

- Full frontend suite: 91 files passed; 870 tests passed, one TODO.
- All four US36 tests passed, along with existing US17 tests.
- Lint and production build passed. React act warnings in other test files and the
  build chunk-size warning did not fail these checks.
- Initial test/build stalls stopped occurring after npm ci. The exact cause was
  not established; no source or runner-configuration workaround was required.

Forced-break check completed for AC-036.1.1: temporarily required a coordinator ID
in the active-event filter. The unchanged test failed at the assertion for the
missing Unassigned planning event (exit 1). The component was restored byte-for-byte
and the same test passed (exit 0). Both logs are stored in docs/test-evidence/us36/.
Only this case was selected, so the other three cases are skipped in those logs.
This is deliberate code-first test-sensitivity evidence, not a product defect or
a TDD cycle. The broken implementation is not retained.

Manual UI checks passed, confirmed by Jaydon on 11 October 2026.
CI for the PR and shared evidence-sheet updates remain pending.

## Manual checks — passed

Tested by: Jaydon. Date: 11 October 2026. Environment: local development UI.
Results below are Jaydon's reported manual verification, not automated browser runs.

1. Lead overview: active events show coordinator, status and dates; workload
   counts are correct — Pass.
2. Open event: link opens the correct event details — Pass.
3. Reassignment: current coordinator and both workload counts update — Pass.
4. Ordinary coordinator: Lead overview is not displayed — Pass.

## Remaining story work

AC-036.2: coordinator/status filters, combined filtering, reset and no-match state.
Complete filters and their verification, PR CI and evidence-sheet
entries before declaring US36 Done. Git commits, pushes and PRs remain with Jaydon.
