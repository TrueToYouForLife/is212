# US20 / SCRUM-65: coordinator event updates

Source: user-supplied SCRUM-65.doc (Jira export generated 16 October 2026).
Initial base: main `8ba1ff3`; rebased without conflicts onto `9474f45` on
17 October 2026. Local branch: `us20/slice1-planning-updates`.

## Acceptance criteria from the attachment

1. Coordinators can update relevant event information during planning.
2. Updates are retained and displayed chronologically.
3. When a selected venue is set to retire, the coordinator can replace it with an
   alternative decided together with Venue Staff.

## Proposed slices

- Slice 1: AC1 and AC2 together, so every permitted edit has an atomic audit record.
- Slice 2: AC3, retired-venue replacement with recorded Venue Staff agreement and
  existing conflict/slot protections. Separate migration claim before implementation.

## Confirmed scope

- The user allocated **0063** for Slice 1 (replacing the proposed 0058).
- The user requested editable fields based on the current files. Reuse existing
  event detail fields and validation: name, purpose, event type, description,
  date/time, attendance, programme, layout, accessibility, facilities, equipment
  and special arrangements. Keep catalogue-backed requirements structured.
- Registration settings retain their dedicated existing workflow. Status,
  ownership, coordinator assignment and venue replacement are not generic detail
  edits; venue replacement belongs to Slice 2.
- Slice 1 eligibility: assigned coordinator on approved/planning events. Other states
  are not editable through this route. History remains readable by the current
  assigned coordinator after planning ends.
- Define the recorded Venue Staff agreement for AC3 when starting Slice 2.

Migration claim: 0063 for US20 Slice 1: assigned-coordinator planning updates,
stale/unauthorised edit protection, and chronological change history, preserving
existing review and booking safeguards.

## Integration points to preserve

- 0054-0056 introduced structured catalogue-backed event requirements. Do not
  reintroduce free-text fields or modify those existing migrations.
- US41 arrangement revalidation is triggered by change-request revalidation rows;
  it must not be assumed to run automatically for a new coordinator edit operation.
  Define and test how significant edits interact with existing arrangements.
- Reuse role/assignment checks, status rules, server identity/time and stale-version
  handling. Approval history and organiser change-request records remain distinct
  from coordinator edit history.
- AC3 must not silently bypass Venue Staff approval or release a confirmed booking
  without an atomic, validated replacement workflow.

## Development and evidence

Use code-first implementation for one AC, then immediate tests before progressing.
Use unique AC-020.Y.Z identifiers and cover normal, boundary, conflict and failure
scenarios where applicable. Commit code/tests with AC IDs. Run complete frontend
and disposable database suites; save logs and coverage. Perform and restore one
deliberate code break for this story and preserve the failing output as evidence.
Update README on completion. Human review remains before push/PR/merge.

Slice 1 implementation and tests are recorded locally. See [Slice 1](us20-slice1.md)
for validation results and evidence. No push, PR or shared database change.
Unrelated root package-lock.json remains untouched. Slice 2 has not started.
