# US20 Slice 1 — coordinator planning updates and history

Story: **SCRUM-65 / US20**, from the supplied Jira export. Criteria: **AC-020.1**
(update event details during planning) and **AC-020.2** (retain chronological updates).
Branch: `us20/slice1-planning-updates`. Migration **0063** was allocated by the user.
Rebased onto main `9474f45` without conflicts, including the waiting-list feature and
migrations 0058–0062. Code and tests: `4b4cf5d`.

## Delivered behaviour

The current assigned Event Coordinator opens **Requests → event → Planning details
and history**. Approved and Planning events expose an editor using the existing
event validation and requirement catalogues. Editable fields are name, purpose,
event type, description, start/end, attendance, programme, layout, accessibility,
facilities, equipment and special arrangements. Registration uses its existing US52
control; status, ownership and assignment use their existing workflows.

The database locks the event, checks role/assignment/status and compares a version
of the loaded event. Stale updates fail instead of overwriting newer data. Direct
browser writes remain blocked. A successful update stores before/after values,
server time and the coordinator's identity/name atomically. A no-op creates no
history. The current assigned coordinator can read history, oldest first, even
after planning ends; authenticated users cannot edit or delete those records.

Significant changes reuse the US41 arrangement checks. Review flags link to the
coordinator's audit record, without creating an organiser change request. Existing
organiser approvals retain their original source link. Venue facilities are also
flagged for review; structured requirement arrays are formatted correctly in review
details. Existing bookings, slot claims and equipment allocations are preserved.
US41 notice records are produced as before; this does not add an email/UI delivery
consumer for those notices.

Failed saves keep entered text. **Reload planning details (discards unsaved edits)**
explicitly loads the latest event and history. Catalogue/read failures are shown as
errors; they never appear as an empty successful history or an editable blank form.

## Development method and evidence

Code-first, followed by tests for the implemented behaviour. AC1 edits and AC2 audit
writes share an atomic transaction and are recorded in the same implementation
commit. This is not a TDD red/green record. Earlier US10 TDD evidence is unchanged.

Evidence is in [`test-evidence/us20/`](test-evidence/us20/):

- `database.log`: complete SQL runner, prior-story regressions, migration replay,
  audit-failure rollback and genuine two-session concurrent editing.
- `frontend-coverage.log`: complete frontend suite and measured coverage.
- `AC-020.1.30-forced-break.log`: deliberately replaced the submitted name with
  `Incorrect event name`. The test expected `Workshop` and failed for that mismatch.
  The original source bytes were restored in `finally`; final checks run after restoration.
- `typecheck.log`, `lint.log`, `build.log`: static checks and production build.
- `coverage-summary.json` and `frontend-coverage.zip`: machine-readable and HTML coverage.
- `traceability.csv`: AC, story, owner placeholder, test name/type/scenario, PR placeholder
  and forced-break evidence. Fill the owner and PR URL when preparing the submission.

Final local verification on 17 October 2026, after rebasing and restoring the
deliberate break:

| Check | Result |
| --- | --- |
| Complete frontend suite | **132 files, 1,235 tests passed**, exit 0 |
| Complete disposable PostgreSQL suite | Passed, exit 0, including waiting-list and existing booking races |
| New Slice 1 cases | **38**: 22 database integration cases and 16 frontend service/component cases |
| Typecheck / lint / production build | All passed; existing Vite large-chunk warning remains |
| New planning service coverage | 100% lines, statements, branches and functions |
| New planning panel coverage | 100% lines, statements and functions; 97.1% branches |
| Whole configured feature coverage | 94.32% lines/statements, 88.9% branches, 93.49% functions |

The overall 100% target is not reached; coverage scope was not reduced. Remaining
panel branches are defensive paths, and existing feature coverage is included in
the overall figures. SQL has behavioural integration tests but is not instrumented
by Vitest coverage. The shell runner line-ending rule in `.gitattributes` keeps
scripts usable in Git Bash on Windows and Bash in CI.

Test ID allocation: SQL `AC-020.1.1–18`, `AC-020.2.1–4`; frontend service
`AC-020.1.30–34`, `AC-020.2.5–6`; frontend component `AC-020.1.50–55`,
`AC-020.2.7–9`. Next IDs: **AC-020.1.56**, **AC-020.2.10**; Slice 2 starts
at **AC-020.3.1**. Gaps separate the test layers and are not missing test cases.

## What to capture for the Scrum submission

1. Capture the full-suite totals from `frontend-coverage.log` and the US20 `PASS`
   lines from `database.log`. These are distinct frontend and database results.
2. Capture the test name, expected/received name mismatch and summary from
   `AC-020.1.30-forced-break.log`. Label it **deliberate test effectiveness check**,
   not a pre-implementation TDD failure or an actual production defect.
3. Use `traceability.csv` for the evidence sheet and place the coverage report in
   submission folder 3. Screenshots supplement the saved logs and commit history.
4. After pushing, add the PR URL and green CI results. Local passes do not establish
   that GitHub Actions has passed.

From the repository root, these PowerShell commands display saved evidence without
rerunning or altering anything:

```powershell
# Full frontend test totals
Select-String -Path docs/test-evidence/us20/frontend-coverage.log -Pattern 'Test Files','Tests  ','Duration'

# Database acceptance-case results
Select-String -Path docs/test-evidence/us20/database.log -Pattern 'PASS: AC-020'

# Deliberate failure and its explanation
Get-Content docs/test-evidence/us20/AC-020.1.30-forced-break.log

# Find implementation and evidence commits
git log --oneline --grep='AC-020'
```

## Manual review still required

Migration 0063 has only been applied in disposable test databases. Apply migrations
in order to the team's development environment through its normal deployment process
before checking the UI; no shared Supabase deployment was performed here.

| Role/setup | Check |
| --- | --- |
| Assigned coordinator, Approved/Planning event | Edit details; save; refresh; confirm persisted details and before/after history. |
| Same event in two browser tabs | Save in one, then attempt a stale save in the other; ensure the second save is refused and entered text remains. |
| Assigned coordinator, event with bookings | Change timing/requirements; check arrangement review reasons and verify the original reservations remain. |
| Other coordinator or organiser | No planning editor/history on the detail page; database tests separately verify refusal. |
| Assigned coordinator, Confirmed/Completed event | History remains available; planning editor is absent. Registration/waiting-list controls retain their own existing rules. |

No manual browser results are claimed. No push, PR, merge or shared database change
has been performed. Slice 2 (AC3: retiring venue replacement) remains outstanding.
