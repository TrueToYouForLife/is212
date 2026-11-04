# US41 arrangement coverage — 4 November 2026

Owner: Jaydon. Branch: `us41-arrangement-coverage`. Tests first inspected against the
existing implementation and ACs; new tests written without changing production code.
No migration, app behaviour, coverage exclusion, shared deployment or Auth change.
No new manual/SQL/live RLS/email-delivery pass. Supabase recovery stays outside scope.

## Results

| Check | Result | Evidence |
|---|---|---|
| Focused baseline |8 tests/3 files passed | before.log |
| Focused final |11 tests/3 files passed | after.log |
| Full frontend coverage |1,760 tests/224 files passed | full.log |
| Typecheck/production build | Passed; existing bundle-size warning | build.log |
| Lint | Passed | lint.log |
| Disposable-copy faults | Two new cases failed on the corresponding faults | probe-broken.log |
| Restored disposable copy |9 tests/2 files passed | probe-restored.log |

| File | Before statements/lines | Before branches | Final statements/lines/functions | Final branches |
|---|---|---|---|---|
| arrangementReviewService.ts |97.29% |97.05% |100% |100% |
| components/ArrangementReviewPanel.tsx |100% |83.72% |100% |95.74% |

`file-coverage.json` stores counters from the baseline and final full run. Global:
98.26% statements/lines,92.54% branches,95.85% functions. These are frontend coverage
measurements, not whole-story acceptance or proof of shared database permissions.

## Useful behaviour covered

- AC-041.1.16: real empty count response versus malformed absent data or a rejected
  read. Failed reads must not clear review badges as zero. Unit; Negative/Boundary/Regression.
- AC-041.1.17: late response from a prior event cannot overwrite the current event's
  independent reasons or count. Component; Negative/Regression.
- AC-041.6.5: mixed retained venue/equipment history, newest first, with original
  references, notes, methods, Singapore times and actor-ID fallbacks when joined
  display data is missing/blank. Resolved reasons are not counted or editable.
  Component; Happy path/Boundary/Regression. Services are mocked.

Current inventory: 28 source IDs (14 integration, five unit, nine component).

## Remaining justification

Panel line 18 has two null-coalescing fallbacks in the resolution-history comparator.
Only resolved records reach it. Migration 0052_arrangement_revalidation.sql lines 21–22
requires a non-null resolution timestamp and actor for every resolved row. Missing
`a.resolved_at` or `b.resolved_at` would violate that database invariant. The service
retains nullable fields for open records; the panel keeps defensive guards. No invalid
resolved records or implementation-only tests were added to force 100% branches.
No uncovered statements/lines/functions in either target. Service: Retested - 100%.
Panel: Justification needed, with this exact location/reason for team review.

## Defects / probes

No genuine product defect was found. In a disposable copy only, changed the failed
count-read catch to return an empty success and reversed the history order. The new
count test and history test failed respectively. Restored both files from unchanged
production source; all 9 targeted cases passed. These are deliberate regression probes,
not product defects, and no probe edits touched the checkout. Synthetic local config
and the existing network guard prevented contact with shared Supabase during tests.
An initial log-path setup error was corrected before the recorded baseline; not a
product or test failure. No false manual pass or external defect entry claimed.

## Shared worklist

Update only the two US41 target rows from these measured results. Service: all four
percentages 100%, uncovered locations None, progress Retested - 100%, justification
blank. Panel: 100% statements/functions/lines,95.74% branches; Branches: 18, progress
Justification needed. Notes: line 18's missing resolution timestamps violate the table
CHECK for resolved rows; retain guards rather than fabricate invalid history.
Shared US7 rows and other owners' file values remain unchanged. Google Sheets File
worklist rows44 and48 were updated and read back: percentages, uncovered locations,
progress and justification. D44/D48 formulas preserved; service justification blank.
Saved to Drive confirmed. Screenshots: shared-sheet-percentages.png and
shared-sheet-progress.png. Temporary/filter criteria were cleared to verify hidden
rows; table headers and filtering controls remain available. Story summary formulas
were not overwritten.
