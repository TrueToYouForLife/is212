# US48 replacement coverage — 4 November 2026

Owner: Jaydon. Branch: `us48-replacement-coverage`. Tests, documentation and evidence
only. No application source, database, migration, API, configuration, coverage
exclusion or shared deployment changes. Supabase infrastructure remains outside scope.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Focused baseline | 17 tests / two files passed | before.log |
| Focused final | 24 tests / three files passed | after.log |
| Focused coverage | 24 tests / three files passed | focused-coverage.log |
| Full frontend coverage | 1,794 tests / 233 files passed | full.log |
| Typecheck and production build | Passed; existing bundle-size warning | build.log |
| Lint | Passed | lint.log |
| Two deliberate faults in disposable copy | Corresponding new tests failed | probe-session.log, probe-back.log |
| Restored disposable copy | 24 tests / three files passed | probe-restored.log |

| File | Before statements/lines | Before functions | Before branches | Final statements/lines/functions | Final branches |
|---|---|---|---|---|---|
| components/ReplacementVenueSearch.tsx | 93.65% | 83.33% | 87.50% | 100% | 100% |
| useVenueReplacements.ts | 89.28% | 100% | 92.85% | 100% | 100% |
| pages/VenueReplacementSearchPage.tsx | 100% | 100% | 82.60% | 100% | 100% |
| components/VenueReplacementPanel.tsx | 100% | 100% | 83.72% | 100% | 97.77% |
| components/ReplacementProposalForm.tsx | 100% | 100% | 95% | 100% | 95% |

Counters and exact uncovered locations: `file-coverage.json`. Baseline is the prior
full run; final counters come from this portion's full run. Global final: 98.41%
statements/lines, 93.56% branches, 96.23% functions. These are file-level frontend
measurements, not whole-story acceptance or database permission evidence.

## Cases and useful behaviour

Seven new component cases, including one React-hook case, are documented in the
[US48 catalogue](../../../test-cases/US48_test_cases.md):

- AC-048.1.6: session checking and interrupted source read cannot start search;
  explicit reload recovers. Negative / Regression.
- AC-048.1.7: changed/disabled session rejects earlier success/failure and reloads
  current context when enabled again. Negative / Regression.
- AC-048.2.7: search/option failures clear candidates, stop loading and recover
  through permitted retry/reload. Negative / Regression.
- AC-048.2.8: obsolete rejected search and late options cannot overwrite current
  search results. Negative / Regression.
- AC-048.2.9: unspecified requirements stay empty; back to selection retains
  adjusted filters and original booking/version. Happy path / Boundary / Regression.
- AC-048.3.15: failed stale decision preserves its note with no false success;
  explicit reload resets consent and the next decision uses the fresh version.
  Negative / Regression.
- AC-048.6.20: shared context avoids duplicate load; retained rejected history has
  honest nullable defaults, no editing/false replacement link, and filters inactive
  facilities. Happy path / Boundary / Regression.

Current US48 source inventory: 56 numeric IDs, including the retained continuous-block
case excluded from replacement totals. Existing US20 IDs and original manual records
are unchanged. Services are mocked; no new manual, SQL, live Auth/RLS or email-delivery
pass is claimed. Transactional preservation/selective resolution remain SQL-tested.

## Remaining justifications

- `VenueReplacementPanel.tsx` line 18: `if (pending.current) return`. The fieldset
  disables decision actions during a save. Ordinary repeated clicks send one request;
  retain the guard against queued/programmatic callbacks without forcing disabled clicks.
- `ReplacementProposalForm.tsx` line 20: `if (pending.current || locked || saved) return`.
  Controls are disabled while pending/locked, and the form is removed after success.
  Normal duplicate clicks and locked failures are tested. Retain the safeguard without
  a forced submit through disabled or removed controls solely to claim 100% branches.

No uncovered statements, lines or functions remain in the five target files. The two
guards are marked Justification needed for team review; other three rows Retested - 100%.

## Defects and regression probes

No genuine product defect found. In a disposable frontend copy only, removed the
hook's obsolete-response guards: AC-048.1.7 detected old-session data overwriting the
new context. Separately disabled the back-to-selection action: AC-048.2.9 failed
because the search controls were not restored. Restored original source after each
probe; all 24 focused tests passed. Synthetic local configuration and the existing
network guard prevented shared API calls. These are deliberate faults, not defects.
Initial command path mistakes were corrected; they were tooling errors, not product
failures. Production files in the repository were never modified by these probes.

## Shared worklist

File worklist rows 26/27/37/38/39 updated and read back; Saved to Drive confirmed.
Only the five rows' E:L result fields were changed. D-column result formulas and
A:C identities were preserved. Three fully covered rows have blank justification;
panel/proposal rows contain the exact line/reason above. Active owner filtering was
cleared to reveal these rows, with filtering controls retained. Screenshots:
`shared-sheet-guards.png` and `shared-sheet-complete.png`. No Automated Test Case Runs
or unrelated owners' result rows were edited.
