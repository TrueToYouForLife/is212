# US48 replacement venues for affected bookings

Owner: Jaydon. Story: SCRUM-243. Code-first development.

## PR1 backend checkpoint — 21 October 2026

Branch: `us48-replacement-integrity`. Claimed migration: **0099**.
Implemented locally and verified; not committed, deployed or manually verified.
US48 is not complete. Prefilled search, reasons in the replacement UI and the
“Needs replacement” display belong to PR2. Final manual/evidence closeout follows.

The existing US20 request table and three RPC signatures are retained. Blocked
bookings use the same proposal, Venue Staff approval/rejection, withdrawal and
retained history as retired venues. A proposal reserves no target cells.

Sources: Week 7 Customer Changes, change 2; section clarification export dated
20 October 2026, #54 and #122. Timing follows #126/#128/#131, which supersede the
historical AM/PM/Night model. AC-048.6 uses the supplied Jira acceptance criterion
refined after the review of PR #109. No additional instructor requirement is inferred.

## Acceptance criteria and remaining work

| AC | Backend result | Remaining for the story |
|---|---|---|
| 048.1 | Current assigned Coordinator receives affected booking IDs, event IDs and blocked/retired reasons from both review stores. | Present reasons and entry points consistently in the UI. |
| 048.2 | Existing event details remain in context; event ID is included for the search integration. | Connect a flagged booking to prefilled buffer-aware search and retain its identity through selection. |
| 048.3 | Reuses proposals and normal Venue Staff approval, including permission, version and conflict checks. | Connect search selection to submission; complete manual verification. |
| 048.4 | No event row is written by replacement. Original reservation remains until the approval transaction commits. | Verify the complete browser workflow. |
| 048.5 | `affectedBookings` includes `needsReplacement: true`, including while a proposal is pending and after rejection/withdrawal. | Render “Needs replacement” on the original booking. |
| 048.6 | Approval releases the original and selectively resolves its open blocked/retired reviews, recording staff and replacement booking. Other reviews remain open. Unsuccessful outcomes roll back or preserve originals. | Verify the deployed workflow and history manually. |

## Eligibility and shared contracts

- Original: Confirmed or Pending approval booking, or an unexpired Held booking,
  on an upcoming Approved, Planning or Confirmed event assigned to a Coordinator.
- A retired venue or an open blocked/retired review makes the original affected.
  Retirement reviews come from `arrangement_review_flags`; blocking reviews come
  from `venue_booking_flags`. Existing retired venues without an open retirement
  review receive a fallback reason from the venue's retirement note.
- Closed/past events, expired holds, unaffected bookings, the same venue and
  inactive targets cannot start a replacement. Only one pending proposal exists
  for an original. Current assignment governs reads/proposals/withdrawal.
- Confirmed events remain Confirmed; replacement changes no event fields. The
  shared approval RPC admits Confirmed events only for an authenticated staff
  approval linked to the checked replacement transaction. Ordinary bookings keep
  their existing Approved/Planning eligibility. This does not implement event
  reconfirmation, safety re-review, registration changes or US49 multi-venue UI.
- **Owner review:** 0099 extends US20's replacement RPCs, US10/US47's shared approval
  function, US12's cancellation cleanup and US41/US46's review records. It does not
  replace either review store or change normal cancellation/block-removal cleanup.

## Transaction and audit design

Both venues lock in UUID order, then the event, original booking and request.
Source versions include the current blocked/retired reasons. Loaded decisions
use the displayed request version; changed source consent requires a new proposal.
A target edit requires staff to reload and recheck the review.

Approval first creates an inactive target booking, then records its checked
replacement link and authenticated staff decision inside the same transaction.
That link lets the original cancellation bypass generic “close every flag” cleanup
and lets the shared approval function recognise a Confirmed-event replacement.
The inactive target avoids violating the one-pending-hold index while the original
is still held/pending. It then enters Pending approval and normal booking approval
checks the target, quarter-hour event cells, venue buffers, closures and effective
occupancy. A failure anywhere rolls back the temporary booking, decision and all
other writes; intermediate states are never committed.

After normal approval succeeds, old claims are released. Existing claim-release
triggers restore maintenance occupancy beneath active blocks. Only open
`venue_blocked`/`venue_retired` booking flags and open `venue_retired` arrangement
reviews are resolved. Other reasons and already-resolved history stay unchanged.
Booking flags gain `resolved_by` and `replacement_booking_id`; arrangement reviews
gain `replacement_booking_id` and reuse `resolved_by`, `resolved_at`,
`resolution_method = corrected` and resolution text. Browser audit writes remain
revoked; actual actors come from `auth.uid()`.

## Deployment and compatibility

0099 requires **0075 and 0098**. Apply it once through the normal shared deployment
process; do not reapply older migrations as a shortcut. New columns and JSON fields
are additive; existing RPC arguments and existing fields are retained. Existing
frontend service schemas continue to accept the context.

Deploying the backend before PR2 is supported, but the old panel still says
“Retired venue replacements” and does not present the new reasons, search or badge.
Do not treat that older UI as completed US48. No coordinated frontend deployment
is needed for this backend PR; PR2 must follow deployment of 0099.

Source tokens now include review reasons, so pending proposals loaded or created
before 0099 can become stale. History is retained; reject/withdraw such proposals
using a freshly loaded decision version and submit a fresh proposal. Never refresh
consent silently or rewrite existing saved proposal versions in a migration.

## Verification

Twenty new grouped SQL integration cases cover the backend requirements and
failure guarantees. Three use separate PostgreSQL sessions. Existing service,
replacement-panel and arrangement-review service compatibility tests also passed
(22 tests / 3 files). No frontend implementation changed, so the full frontend
suite, coverage, build and lint were not rerun for this backend portion.

Focused, upgrade, fresh-order and historical database runners exited 0. The
historical runner deliberately excludes 0075/0098/0099 and still runs US20's original
replacement cases/race. The current runner applies 0099 after its historical
0075/0098 replays, tests populated replay preservation and runs US48 races.
See [test cases](test-cases/US48_test_cases.md) and
[evidence](test-evidence/us48/README.md).

No product defect was demonstrated during this portion. Fixture setup mistakes
were corrected: staff cannot assign Coordinators or directly select the event
rows used for block setup. Expected refusals and deliberately injected review-write
failure are negative-path verification, not discovered defects or TDD evidence.

## Next portions

1. Merge/deploy PR1 after review; Jaydon handles Git and shared deployment.
2. Implement PR2 on a new branch: affected reasons, Needs replacement display,
   prefilled search and proposal selection using the existing service boundaries.
3. Complete final browser checks, evidence sheet and AC audit. Record only actual
   manual results. Shared sheet updates remain pending; automated runs stay in CI.
