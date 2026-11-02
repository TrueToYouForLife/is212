# PR170 verify failure and test isolation correction

Owner: Jaydon. PR: [#170](https://github.com/TrueToYouForLife/is212/pull/170).
Failed revision: `c94d336d63afb7d0e954dbd1f740d74bdb18e4ff`.

## Observed CI failure

The [pull-request verify job](https://github.com/TrueToYouForLife/is212/actions/runs/41476450699/job/125383165995?pr=170)
failed in Test with coverage. Typecheck/lint passed; Build was skipped after the test
failure. Both database jobs and the separate push verify job passed. These are
observed statuses on the original revision, not a passing CI claim for this correction.

The job annotations reported:

```text
VenueBookingPages.test.tsx:295 — AC-009.9.17
TestingLibraryElementError: Found multiple elements with the role "alert"
  Your venue booking requests could not be loaded.
  Venue replacements could not be loaded. Please reload.

VenueCancellationPanel.tsx:17 — logged during AC-010.9.6
TypeError: Cannot read properties of undefined (reading 'then')
  getVenueCancellation(bookingId).then(...)
```

This is a diagnostic excerpt transcribed from the job annotations, not a downloaded
complete CI log. The booking-page test left replacement/decision-notification reads
unmocked and restored mocks before explicitly unmounting components. That permits
an unrelated panel error to race the single-alert query and is consistent with a late
cancellation effect observing a reset mock. The exact late-effect scheduling was not
reproduced locally: the unchanged file's initial targeted run passed 25 tests. Do not
claim a deterministic local reproduction or infer a product/API defect from the mock
returning undefined.

## Correction

- Explicitly mock replacement and decision-notification services with valid empty
  results; keep the real UI components mounted. Dedicated feature tests remain intact.
- Unmount/flush component effects before restoring mocks and timers.
- AC-009.9.17 now deliberately returns both booking and replacement read errors and
  checks each specific message has role alert. It still rejects a false empty state;
  it does not weaken the test to accept whichever alert appears first.

Only the shared test file changes behaviour. US9/10/11/49 catalogue source anchors
are refreshed after its line shifts, and US9's existing case description records the
concurrent-error scenario. Ownership and IDs remain unchanged. No production component,
API, migration, permission or CI configuration is changed. This is necessary shared
test integration for PR170, not new functionality in those stories.

## Local verification

| Evidence | Result |
| --- | --- |
| [frontend-coverage.log](frontend-coverage.log) | Exit 0; complete suite: 1,717 tests / 213 files. Coverage 96.47% statements/lines, 91.17% branches, 94.76% functions |
| [shuffled-targeted.log](shuffled-targeted.log) | Exit 0; 32 tests / three files: booking pages, US48 booking/replacement integration and cancellation panel. Shuffled order, seed 170, checks teardown/order independence |
| [typecheck.log](typecheck.log) | Exit 0 |
| [lint.log](lint.log) | Exit 0 |
| [build.log](build.log) | Exit 0; existing large-bundle warning remains |

Full coverage/build and the shuffled check used CI placeholder Supabase values;
the test setup blocks network access. No live user or shared database was used.
An earlier corrected targeted coverage run passed 28 tests across booking pages and
booking/replacement integration; the full suite and correctly named shuffled files
above supersede that narrower check. Logs have CLI whitespace/endings normalised.

Database gates were not rerun because database code/runners did not change and both
CI database jobs already passed. No manual UI pass, delivered email, new test ID or
product-defect sheet row is claimed. Push this follow-up commit and require the new
GitHub checks to pass before merging; local success is not a remote CI result.
