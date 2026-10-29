# US24 PR2 frontend evidence

Owner: Jaydon. Updated: 29 October 2026. Code-first development.
Jaydon confirmed the backend PR merged and 0112 applied. No new migration.

## Verification

- `targeted-retry.log`: all 14 new cases passed (six unit, eight component).
- `frontend-coverage.log`: full suite passed, 1,590 tests across 189 files. Coverage:
  96.27% statements/lines, 90.84% branches, 95.18% functions. Two workers limit resource
  use; this was the full suite, not an equipment-only filter. Command exited 0.
- `lint.log`: lint passed, exit 0.
- `typecheck-initial.log` and `typecheck-retry.log`: typecheck eventually passed, exit 0.
- `build.log`: typecheck and production build passed, exit 0, in a disposable copy with
  the same source/manifests and dependencies installed from the existing lockfile.
  Existing large-bundle warning remains; no new bundle policy is claimed.
- Shell/repository changed-line and new-file whitespace checks passed. CLI trailing
  whitespace/blank EOF lines are normalised without changing result/error text.

No product code changed after these successful regression checks. Subsequent edits are
verification notes/manual guidance. Database contracts were unchanged, so PR1's real
PostgreSQL permission/atomicity/availability/concurrency results are not presented as
new PR2 runs. Story total: 37 grouped cases (23 database integration, six unit, eight
component). These frontend tests mock services/Supabase/session context; they do not
establish live Auth/API behaviour, manual acceptance, shared frontend deployment or
delivered email.

## Environment failures and build copy

`targeted-initial.log` stopped before assertions because loading a PostCSS plugin hit
an OS file-read error (unknown system error -70). The targeted retry passed without
product, dependency or configuration changes to address that error. A sample of the
stalled typecheck process showed it waiting in a filesystem read; the exact underlying
cause is unconfirmed. The full regression run was also slow reading local files but
completed successfully.

`build-read-timeout.log` records the original repository build failing with ETIMEDOUT
on a read before transforming any modules. The successful build used a disposable
`/tmp` copy: tracked frontend from this branch's HEAD plus all 10 current US24 source/
test changes. `build-copy-source-hashes.log` verifies the copied files and both package
manifests match the repository. Dependencies were installed only in that disposable
copy using `npm ci --offline --ignore-scripts --no-audit --no-fund`; the repository's
node_modules, package files and configuration were left unchanged. No environment
files or live credentials were copied. Build uses CI placeholder Supabase values.

These are environment failures, not application defects or deliberate forced breaks.
No genuine product defect was found in PR2; there is no automated defect-sheet entry
to invent. No full-suite rerun is claimed after the original successful full run.

## Manual acceptance

Jaydon reported all eight chat manual-check groups passed on 29 October 2026.
See `../manual-results.md` for the confirmed scope, deployment/setup failure and
reporting limits. The optional offline test is not claimed. Physical checkout,
storage movement, automatic availability blocking while pending and delivered email
are not claimed.

Provide spreadsheet rows directly in chat at story closeout; no TSV files or Automated
Test Case Runs entries are created here. Jaydon owns commits, PR, merge/deployment and
the Jira transition. UI is manually accepted and ready for PR review; frontend merge/deployment and CI
are not yet claimed.
