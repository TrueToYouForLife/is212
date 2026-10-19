# US20 Slice 2 — retiring venue replacement

## Starting checkpoint — 18 October 2026

Slice 1 merged in PR #98 (`06173a6`). This slice starts from main `07255f9`,
which also includes the venue search/filter changes from PR #95.
Local branch: `us20/slice2-retiring-venue-replacement`.
Migration, UI, service and tests are implemented locally. No push, PR, merge or
shared database deployment has been performed for Slice 2.
The unrelated root package-lock.json remains untouched.

## Acceptance criterion

AC-020.3: when a selected venue is set to retire, the coordinator can replace it
with an alternative decided together with Venue Staff.

## Confirmed scope and migration claim

- The user allocated **0065**, replacing the proposed 0064, before creation.
- The user confirmed using the existing **retired** status. There is no new
  retirement schedule/date/status and no modification of retirement management.

Claiming migration **0065** for **US20 Slice 2: retired venue replacement**.
Adds assigned-coordinator proposals, recorded Venue Staff approval/rejection,
stale/conflict checks and an atomic replacement booking switch. Preserves the
original reservation until approval succeeds and retains proposal/decision history.

## Implemented transaction and role flow

1. The current assigned coordinator proposes an active replacement for an eligible
   existing booking, with a reason/agreement note. Preserve the original booking.
2. Venue Staff review the linked original and proposed replacement, current event
   requirements, and slot conflicts. Record the actual staff identity and decision;
   a coordinator-entered staff name is not sufficient evidence of agreement.
3. Approval rechecks eligibility, current assignment/event details, venue status,
   required event/buffer cells and conflicts under locks. Confirm the replacement
   and release the original reservation atomically. A failure preserves the original.
4. Rejection leaves the original booking intact and records the decision and reason.
5. Retain the original/replacement link and decision history so the switch can be
   traced after refresh and coordinator reassignment.

The coordinator uses **Your venue bookings → Retired venue replacements**; Venue
Staff use **Pending venue bookings → Retired venue replacements**. Both display
retained request/decision history. The coordinator may withdraw an undecided
proposal; every staff decision or withdrawal needs a note.

Eligibility follows existing booking rules: the event is Approved or Planning,
the original venue is Retired, and the original booking is Confirmed,
Pending approval or a live Held booking. Confirmed/closed events and expired holds
are excluded. The replacement venue must be Active. Multiple pending proposals
for the same original booking are prevented by a unique index.

Proposals do **not** hold alternative slots. Venue Staff compare displayed event
requirements with venue information; suitability remains a staff decision, not a
new automatic suitability guarantee. Approval reuses `approve_venue_booking` for
current target status, event timing, buffers, blocks and claim conflicts. Old claims
are deleted only after the new booking is confirmed, inside the same transaction.
Any error restores the original booking and its claims. Existing expired claims
are conservatively treated as occupied until released through the existing workflow.

Event/booking/assignment changes invalidate the original proposal. Reloading does
not silently grant coordinator consent to changed details: withdraw/reject and
submit a fresh proposal. Target changes invalidate a loaded staff review version;
reload and recheck before deciding. Both venues are locked in UUID order, followed
by the event, booking and proposal. A competing decision has only one winner.

History stores actual server-authenticated proposer/reviewer identities, names,
notes and timestamps, plus the original/replacement booking link. Coordinator reads
follow current assignment; Venue Staff can review the queue. Browser insert/update/
delete on the audit table is prohibited. Existing retirement/revalidation flags
remain historical records; this slice does not silently resolve unrelated flags.

## Verification and evidence plan

Code-first implementation followed by tests. IDs: SQL **AC-020.3.1–21**;
service **AC-020.3.30–37**; panel **AC-020.3.50–59**; existing host pages
**AC-020.3.60–61**. There are **41 new cases** (21 SQL, 20 frontend), covering
normal, boundary, conflict and failure scenarios. Next unused ID: **AC-020.3.62**.

Evidence is saved separately in `docs/test-evidence/us20-slice2/`, preserving Slice 1:
full database/frontend logs, typecheck/lint/build logs, coverage JSON/HTML archive
and `traceability.csv`. The full SQL runner includes rollback, migration replay,
pending/live-held replacements, expired holds and a real two-session decision race.

Final local verification on **18 October 2026**, based on main `07255f9` (the final
fetch found no newer main):

| Check | Result |
| --- | --- |
| Complete frontend coverage run | **134 files, 1,255 tests passed**, exit 0 |
| Complete disposable PostgreSQL suite | Passed, exit 0; all 21 new AC3 checks passed |
| Typecheck / lint / production build | Passed; lint has no warnings; existing Vite large-chunk warning remains |
| New replacement service coverage | 100% lines, statements, branches and functions |
| New replacement panel coverage | 100% lines, statements and functions; 87.5% branches |
| Complete configured feature coverage | 94.46% lines/statements, 89.02% branches, 93.37% functions |

The 100% overall coverage target is not met: some panel branches and existing
feature code remain uncovered. Coverage scope was not narrowed. SQL is covered
by behavioural integration tests rather than Vitest instrumentation.

The story already has a recorded deliberate-break check from Slice 1:
`docs/test-evidence/us20/AC-020.1.30-forced-break.log`. It was restored and is not
a TDD red-phase record. There is no need to manufacture another failure for this
slice. Local checks do not establish that GitHub Actions or manual UI review passed.

## Manual review and Scrum evidence

Apply 0065 through the team's usual development deployment process before browser
testing. Do not rerun earlier migrations out of order. No shared deployment was
performed here. Check:

1. Coordinator assigned to an Approved/Planning event with a booking at a retired
   venue: propose an active alternative and confirm the original reservation remains.
2. Venue Staff: review event/venue details, enter a note, approve, and verify the new
   booking is confirmed and old slots released. Both roles can read the decision.
3. Reject a different proposal; verify the original booking remains. The coordinator
   can withdraw and submit another proposal.
4. Occupy/block the alternative after proposal, then approve: approval must fail and
   the original must remain. Change event details after proposal: a fresh proposal
   is required. These scenarios are also covered in automated SQL tests for claim
   conflicts and stale event details; manual results remain unrecorded.

From the repository root, display saved evidence for screenshots:

```powershell
# Full frontend summary
Select-String -Path docs/test-evidence/us20-slice2/frontend-coverage.log -Pattern 'Test Files','Tests  ','Duration'

# Slice 2 database results, including the real race
Select-String -Path docs/test-evidence/us20-slice2/database.log -Pattern 'PASS: AC-020.3.'

# Story-level deliberate-break evidence (Slice 1)
Get-Content docs/test-evidence/us20/AC-020.1.30-forced-break.log

# AC-labelled local commit history
git log --oneline --grep='AC-020'
```

Use `traceability.csv` for the submission sheet; fill in the owner and PR URL.
Put the latest coverage archive/report in submission folder 3. Add PR and green CI
evidence after publication. Human review remains before push, PR and merge.
