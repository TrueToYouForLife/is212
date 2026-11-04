# US47 buffer-settings coverage — 4 November 2026

Owner: Jaydon. Branch: `us47-buffer-coverage`. Only tests, documentation and evidence.
No production code, database, API contract, migration, coverage exclusion or shared
Supabase configuration change. US48 replacement files remain a separate portion.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Focused baseline | 3 tests / one file passed | before.log |
| Focused final | 7 tests / two files passed | after.log |
| Full frontend coverage | 1,787 tests / 232 files passed | full.log |
| Typecheck and production build | Passed; existing bundle-size warning | build.log |
| Lint | Passed | lint.log |
| Two deliberate faults in disposable copy | Corresponding new tests failed | probe-broken.log |
| Restored disposable copy | 7 tests / two files passed | probe-restored.log |

| File | Before statements/lines | Before branches | Final statements/lines/functions | Final branches |
|---|---|---|---|---|
| venueBufferSettingsService.ts | 87.09% | 61.53% | 100% | 100% |
| components/VenueBufferSettings.tsx | 100% | 93.75% | 100% | 96.96% |

Counters and missing locations are in `file-coverage.json`. Full frontend global:
98.36% statements/lines, 93.20% branches, 95.97% functions. Changes to global totals also
include teammates' merged work; they are not attributed solely to these tests.

## Cases

- AC-047.1.8: safe distinct read/save refusals; malformed/interrupted reads do not
  become invented defaults. Unit — Negative / Regression.
- AC-047.1.9: no write for invalid values/version; zero and integer-range boundary;
  exact independent duration/version payload; malformed/lost save outcomes do not
  claim success. Unit — Happy path / Negative / Boundary.
- AC-047.1.10: a late prior-venue read cannot replace current settings/version.
  Component — Negative / Regression.
- AC-047.1.11: pending state prevents edits and duplicate clicks; refusal retains
  inputs without success, followed by explicit retry. Component — Happy path /
  Negative / Regression.
- Extended AC-047.1.6: reload after stale refusal resets values and the next save
  uses the newly read version, including zero defaults.

Current US47 catalogue: 65 numeric source IDs; all appear in its test-case markdown.
Supabase is mocked; no new manual, SQL, live authorisation or email-delivery pass.

## Remaining justification

`VenueBufferSettings.tsx` line 26: `if (!settings || busy || stale) return`.
The form is not mounted until settings exist; its submit button and inputs are disabled
while busy/stale. Tests exercise the visible pending and stale states through normal
controls. The guarded early exit is retained for queued/programmatic submissions;
no forced event on a disabled or nonexistent form was added merely to reach 100%.
No uncovered statements, lines or functions in either file.

## Defects and regression probes

No genuine product defect found. In a disposable copy with synthetic local config and
the network guard, removed service input validation and bypassed late-load cancellation.
AC-047.1.9 and AC-047.1.10 failed respectively. Restored both production files in that
copy; all seven tests passed. These are deliberate faults, not product defects. No
source probe edits, credentials or shared database calls were made in the checkout.

## Shared worklist

Service: all four metrics 100%, no uncovered locations, Retested - 100%, justification
blank. Panel: 100% statements/functions/lines, 96.96% branches; Branches: 26;
Justification needed, with the exact guard explanation above. File worklist rows 36
(service) and 40 (panel) were updated, read back and confirmed saved to Drive. Only
their E:L result fields changed; existing D-column result formulas were preserved.
Screenshots: `shared-sheet-results.png` and `shared-sheet-panel.png`. Existing test
evidence and old manual checkpoints remain separate.
