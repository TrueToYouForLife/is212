# Release UI fixes — 4 November 2026

Owner: Jaydon. Branch: `us27-us42-release-ui-fixes`. No migration or shared deployment.
These are two bounded release findings, not a claim that the whole QA checklist passed.

## Defects and changes

1. Owning Organiser saw permission/load errors from Coordinator-only readiness,
   venue-booking and internal safety panels on the shared request page. The page
   mounted the staff panels for either audience, despite their RPC permissions.
   Mount them only for the assigned Coordinator, retaining the existing Organiser
   venue/equipment summaries. Database permissions are unchanged. Shared integration
   review is required for US5/43, US49 and US44.
2. In two tabs, Technical Support's second PRJ-003 status save remained Saving with
   Reload/Close disabled rather than showing a stale refusal. No overwrite observed.
   Root cause remains unconfirmed. Add a 15-second save deadline plus abort signal;
   report an unknown outcome, retain the note, block retry until explicit reload and
   ignore late completion. Aborting is not proof that a write was rolled back. Staff
   must copy the note and reload/check current status and history before retrying.
   This is recovery from an unresponsive request, not a fix to shared Auth internals.

Pre-fix symptom: `status-before.txt`; original browser evidence remains in the local
release QA working folder. No Jira bug key supplied; no external defect log edited.

## Automated verification

- 27 targeted tests across six files passed: status service/panel, Organiser page and
  shared-page audit, registration and change-request regressions. See `targeted.log`.
- Full frontend regression: 1,749 tests across 223 files passed once, after final
  source/test changes. See `frontend-regression.log`.
- Typecheck/production build passed; lint passed. Build retains the bundle-size warning.
- No database tests needed: no SQL, API signatures or grants changed. No new coverage
  percentages or 100% coverage claim. Unit/component services are mocked.
- Added AC-027.8.10 (unit Negative/Boundary/Regression) and AC-042.3.8 (component
  Happy path/Negative/Regression); extended AC-027.5.9 to cover timeout recovery.
- Initial focused tests passed but exposed a missing audit-child mock in the page
  harness (network guard refused its calls); added that mock. Not a product defect.
- First evidence-log redirection used the wrong working directory; corrected before
  the recorded targeted run. Not a test failure or application defect.

## Browser retests

Local app, existing shared test database, Chrome incognito; corrected public key.
Authenticated test accounts are recorded below; no claim about delivered email.

- Organiser (`organiser@test.com`), EVT-2026-0031: event details, approved replacement
  venue and Projector Reserved 1/1 visible. Coordinator-only readiness, booking card,
  safety history and their permission errors absent. PASS. `organiser-after.txt`.
- Technical Support (`tech@test.com`), PRJ-003: loaded Damaged in two tabs. First save
  Under Maintenance succeeded with zero affected reservations and auto-closed panel.
  Second tab's Unavailable save exited Saving with timeout guidance, retained note,
  enabled Reload/Close, and kept Save disabled. Close worked. PASS for bounded
  recovery. `status-timeout-after.txt`. This does not establish the stall's cause.

## Review / deployment

Jaydon reviews, commits and opens one PR. Ask shared-page owners to review before
merging. Frontend deployment only; no migration. Record findings and retest results in
Jira/shared checklist separately. Earlier incomplete E2E variants remain unrun.

### Recovery limitation during fixture cleanup

After the timeout retest, reloading the catalogue and starting a separate normal
Chrome session stalled at Checking session. DevTools showed the profile read to
Supabase pending. Therefore this run does not establish that page reload alone always
recovers the session. PRJ-003's last confirmed state is Under Maintenance (originally
Damaged); both states exclude it from usable stock and the confirmed save affected
zero reservations. Restoration remains pending until the backend/session read responds.
Do not mark the underlying multi-tab/session stall resolved; this PR fixes the unbounded
status-save UI and the Organiser panel visibility. No shared Auth change is included.
