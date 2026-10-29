# US48 replacement venues for affected bookings

Owner: Jaydon. Story: SCRUM-243. Code-first development.

## Current checkpoint — safety-stage compatibility, 29 October 2026

Jaydon reopened US48 in Jira and created `us48-safety-stage-replacements`, claiming
migration `0116_us48_safety_stage_replacements.sql`. This follow-up implements the
24 October discussion with Jeremiah and Jaydon's 25 October agreement: replacements
also work in **Awaiting safety review** and **In preparation**.

0116 replaces four existing functions using their current 0099/0102 definitions:
`get_venue_replacements`, `propose_venue_replacement`, `decide_venue_replacement` and
`approve_venue_booking`. Only the agreed stage predicates change. Existing signatures,
per-booking layout/attendance, permissions, consent versions, quarter-hour occupancy,
buffers, atomic replacement and selective resolution remain supported. Existing UI
search/panels consume the unchanged contracts; no frontend source change is needed.
The shared approval exception still requires a browser-unwritable approved replacement
link, the current approving Venue Staff member and the cancelled original from the
same event. Ordinary bookings do not gain approval access in these stages.

No event information/status, stored safety decision or safety-review settings are
changed. Safety changes requested gains no new replacement permission. US27 status
reviews are unchanged. US45 transitions/re-review remain Jeremiah's integration work;
this patch does not claim that a stored safety assessment covers a replacement venue.
Notify Jeremiah about the shared approval-function extension and coordinate it with
his safety workflow before enabling that complete workflow. No team message was sent.

Deployment: apply 0116 after 0099/0100/0102/0108 and the team's current baseline.
No additional frontend deployment is required for this database contract change.
Replaying older replacement/approval migrations after 0116 would restore their older
stage checks; apply 0116 last after any such deliberate replay. The historical runner
skips 0116; quarter-hour upgrade/fresh gates install/test it after historical replays.
Jaydon owns shared deployment, commits, PR and merge. None is claimed for this patch.

Verification and limits: [safety-stage evidence](test-evidence/us48/safety-stages/README.md).
Seventeen new grouped SQL integration cases cover both stages, real role checks,
blocked/retired sources, buffered occupancy, retained event/decision history, selective
resolution, stale source/decision consent, ordinary-approval refusal, expected rollback,
replay and six real concurrent-session races. Manual checks for this patch remain pending;
the original 21 October manual results below are historical, not new-stage evidence.

### Manual checks after Jaydon applies 0116

Use disposable events already prepared in each agreed stage with an approved venue
booking, the assigned Coordinator and Venue Staff accounts. Coordinate fixture/stage
preparation with Jeremiah; do not enable the shared safety workflow just to test this patch.

1. Venue Staff blocks one original venue over the booking interval, or retires another
   disposable original with a reason. The reservation remains in place.
2. Assigned Coordinator opens Your venue bookings and checks Needs replacement/reason.
   Find replacement must open with the original interval and per-booking attendance/layout.
3. Submit a proposal. Original reservation/event stage remain; target is not reserved yet.
   Check withdrawal/rejection still retain the original and its open reasons.
4. Venue Staff approves a current proposal. Target is confirmed with buffers, original is
   released and only blocked/retired reviews resolve with that staff/replacement audit.
   An independent capacity/details review remains open; event stage/information remain.
5. Repeat for the other agreed stage and for blocked versus retired originals. A target
   setup/turnaround conflict must refuse approval and leave the original and reviews intact.
6. After a proposal, change relevant event information or stage using an agreed test
   fixture. Old consent must refuse; decision reload alone cannot bypass changed source
   consent. Other Coordinators/roles and ordinary safety-stage booking approvals remain denied.

Record only checks actually performed; no new manual pass or email delivery is claimed.

## Historical checkpoint — documentation closeout, 21 October 2026

Implementation is merged in [PR #127](https://github.com/TrueToYouForLife/is212/pull/127)
and [PR #128](https://github.com/TrueToYouForLife/is212/pull/128). PR #128 shows all
four checks passed. Current documentation branch: `us48-docs-closeout`.
Jaydon confirmed all nine manual-checklist steps passed; no manual defect was reported.
See [manual results](test-evidence/us48/manual-results.md) for the grouped results.
All six ACs have implementation and passing automated/manual evidence. Jaydon
confirmed the evidence sheet is up to date. Documentation merge and Jira transition
remain with Jaydon.

0099 deployment was explicitly confirmed. The reported continuous-block workflow
exercises 0100 functionality; no separate deployment timestamp/operator was supplied.
No email delivery is claimed. This closeout changes documentation only and does not
claim a new test run.

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

**Verification:** 31 direct US48 cases (20 backend, 11 frontend), plus shared
blocking/replacement/buffer regression coverage;
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
Apply **0100 after 0099**, then deploy this frontend. 0099 is confirmed applied.
The 0100-dependent manual workflow is now reported passed by Jaydon; a separate
deployment timestamp/operator was not supplied. Older clients'
date/slot writes remain supported, but this frontend selects the added timestamp
columns and requires 0100. Do not reapply earlier migrations after 0100: they restore
older function definitions. Jaydon handles review, merge and shared deployment.

## PR1 backend checkpoint — 21 October 2026

Branch: `us48-replacement-integrity`. Claimed migration: **0099**.
Historical PR1 checkpoint: subsequently merged in PR #127. The backend verification
below describes that portion; see the current closeout checkpoint above for UI progress.
This was the PR1 checkpoint; subsequent deployment/manual progress is recorded above.

The existing US20 request table and three RPC signatures are retained. Blocked
bookings use the same proposal, Venue Staff approval/rejection, withdrawal and
retained history as retired venues. A proposal reserves no target cells.

Sources: Week 7 Customer Changes, change 2; section clarification export dated
20 October 2026, #54 and #122. Timing follows #126/#128/#131, which supersede the
historical AM/PM/Night model. AC-048.6 uses the supplied Jira acceptance criterion
refined after the review of PR #109. No additional instructor requirement is inferred.

## Acceptance criteria closeout

| AC | Implementation | Verification |
|---|---|---|
| 048.1 | Current assigned Coordinator receives affected booking IDs, event IDs and blocked/retired reasons from both review stores. | Pass — reason/status and replacement search checks reported by Jaydon. |
| 048.2 | Existing event details remain in context; event ID is included for the search integration. | Pass — full event timing/requirements prefill reported by Jaydon; search/reset/stale results covered automatically. |
| 048.3 | Reuses proposals and normal Venue Staff approval, including permission, version and conflict checks. | Pass — proposal, staff approval, access and stale-consent checks reported by Jaydon; races/permissions also covered automatically. |
| 048.4 | No event row is written by replacement. Original reservation remains until the approval transaction commits. | Pass — event information/status and original reservations preserved through the reported workflow; full-row preservation covered automatically. |
| 048.5 | `affectedBookings` includes `needsReplacement: true`, including while a proposal is pending and after rejection/withdrawal. | Pass — Needs replacement remains through pending/rejected/withdrawn outcomes and clears after approval, reported by Jaydon. |
| 048.6 | Approval releases the original and selectively resolves its open blocked/retired reviews, recording staff and replacement booking. Other reviews remain open. Unsuccessful outcomes roll back or preserve originals. | Pass — approval/release, independent reason, staff/replacement audit, retirement, refusal/rejection/withdrawal checks reported by Jaydon. |

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

Jaydon confirmed the evidence sheet is up to date, covering the US48 overview,
manual results and fixed automated defect. Shared regression tests remain in the
repository; no other story's rows are part of this submission. Automated Test Case
Runs stays with GitHub Actions. Future sheet rows are provided directly in chat.

1. Review and merge the documentation-only `us48-docs-closeout` PR. No new migration,
   deployment, product changes or repeat full-suite run is needed for this portion.
2. Complete the Jira transition according to the team's review process. Jira Done
   and documentation merge are not claimed complete until Jaydon confirms them.
