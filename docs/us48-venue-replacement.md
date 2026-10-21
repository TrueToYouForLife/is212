# US48 replacement venues for affected bookings

Owner: Jaydon. Story: SCRUM-243. Code-first development.

## Current checkpoint — PR2 UI, 21 October 2026

PR1 merged in **PR #127**. Current branch: `us48-replacement-ui`. The frontend
portion is implemented locally and verified; commit/PR/merge remain with Jaydon.
Jaydon confirmed migration 0099 has run. Do not infer a
manual pass or mark US48 complete before the deployed workflow is checked.

- Your venue bookings shows each affected original with **Needs replacement** and
  its blocked/retired reasons. The badge stays through pending, rejected and
  withdrawn proposals. Reloading after approval refreshes booking status and removes
  the badge from the released original.
- Find replacement opens `/venues/bookings/:bookingId/replacement`. It reads the
  assigned Coordinator's current replacement context; invalid, inaccessible,
  ineligible and already-pending originals do not start a search.
- Search uses the existing venue search service and quarter-hour catalogue. The
  original event ID keeps its complete date/time interval and venue-specific
  occupancy rules; attendance, layout, accessibility and facilities prefill from
  the event. Event selection is locked. Adjusting filters does not update the
  event; Clear filters restores its original requirements. Staff still review the
  actual event requirements before approval.
- A result is selected within the replacement flow rather than opening ordinary
  hold creation. A required note, original booking ID, selected venue and displayed
  source version go to the existing proposal RPC. No browser reservation writes or
  event writes were added. Success links back to booking/decision history.
- Submitting disables duplicate submission and reload. An unsuccessful response
  retains the note and locks retry until explicit reload; consent is never silently
  refreshed. A reload discards the selected venue/note and reads current eligibility.
- The replacement panel is now named Venue replacements and retains staff
  approval/rejection, Coordinator withdrawal and recorded decision history. The
  bookings page shares its context load with the panel. Existing venue alerts also
  link to replacement search; a pending/obsolete alert link fails closed there.

**Shared frontend contracts:** VenueFilters has optional event-lock and searching
props; VenueResultCard has optional selection mode. Existing ordinary search and
navigation retain their defaults. The service validates 0099's affectedBookings,
source event IDs and reason records; an older database contract produces a load
error rather than false empty eligibility. The shared blocking refinement below additionally requires migration 0100.

**Verification:** 12 new grouped US48 frontend cases plus four shared US12 cases;
1,516 tests passed across 173 files in the final full coverage run. Build (including
typecheck) and lint passed. Configured coverage: 95.73% lines/statements,
90.46% branches, 95.05% functions; scope unchanged. Existing Vite chunk warning remains.
Historical, populated upgrade and fresh-order Docker database gates passed, including
11 new shared US12 SQL cases for continuous blocks, preservation/replay and concurrency.

**One product defect found and fixed:** AC-048.2.3 exposed a completed options-load
failure still labelled Searching because shared filter controls used disabled as
the loading label. Separating the searching label from disabled state fixes it.
Failure output is retained. Unsupported test assertion options and expecting
Cancelled instead of the existing Released label were test mistakes, not defects.

**Venue-block timing refinement requested by Jaydon:** one continuous interval,
for example 21 October 21:00 → 22 October 08:00, replaces the earlier proposed daily
range interpretation. Start/end dropdowns use 15-minute steps in Singapore time.
End is exclusive. 00:00 means midnight on the selected end date; 24:00 means the end
of that date. Full day sets 00:00–24:00, including all intermediate days for multi-day blocks.
Changing dates/times invalidates confirmation until previewed again.

Migration **0100_continuous_venue_blocks.sql** adds nullable exact timestamps to
`venue_closures`. Existing rows retain their dates/selected slots, including gaps;
no backfill, booking rewrite or claim rewrite occurs. New `block_venue_period` and
`preview_venue_block_period` RPCs accept explicit instants. Legacy RPC signatures
remain available. The checked shared implementation serializes by venue and uses
exact cell membership in holds, approval, staff review, buffer/event revalidation
and released-cell reblocking. Existing US48 atomic/selective resolution remains.
Private helpers have no browser execution grants. Original bookings remain and
receive review flags; email is queued in the existing outbox, not proof of delivery.

**Shared-owner/deployment dependency:** this changes US12 block storage/read contracts
and touches US47 conflict readers. Notify their owners before shared deployment.
Apply **0100 after 0099**, then deploy this frontend. 0099 is confirmed applied;
0100 is local only and no shared deployment or manual pass is claimed. Older clients'
date/slot writes remain supported, but this frontend selects the added timestamp
columns and requires 0100. Do not reapply earlier migrations after 0100: they restore
older function definitions. Jaydon handles review, merge and shared deployment.

## PR1 backend checkpoint — 21 October 2026

Branch: `us48-replacement-integrity`. Claimed migration: **0099**.
Historical PR1 checkpoint: subsequently merged in PR #127. The backend verification
below describes that portion; see the current PR2 checkpoint above for UI progress.
This was the PR1 checkpoint; 0099 deployment was subsequently confirmed by Jaydon. Manual verification remains pending.

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
| 048.1 | Current assigned Coordinator receives affected booking IDs, event IDs and blocked/retired reasons from both review stores. | Implemented in PR2; manual confirmation pending. |
| 048.2 | Existing event details remain in context; event ID is included for the search integration. | Implemented in PR2; manual confirmation pending. |
| 048.3 | Reuses proposals and normal Venue Staff approval, including permission, version and conflict checks. | Selection/submission implemented in PR2; complete manual verification. |
| 048.4 | No event row is written by replacement. Original reservation remains until the approval transaction commits. | Verify the complete browser workflow. |
| 048.5 | `affectedBookings` includes `needsReplacement: true`, including while a proposal is pending and after rejection/withdrawal. | Implemented in PR2; manual confirmation pending. |
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

## PR1 verification

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

## Remaining closeout

1. Jaydon reviews, commits and opens PR2; wait for CI/review and merge.
2. Apply claimed migration 0100 after review/merge, then verify the deployed UI with the manual checklist.
3. Record actual manual results and any manual defects, update the evidence sheet,
   and audit all six ACs before marking US48 complete. Automated runs stay in CI.
