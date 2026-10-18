# US47 test cases

Owner: Jaydon. Updated: 19 October 2026. Code-first development.

These foundation cases cover database primitives, not the complete user-facing ACs.
File: `backend/supabase/tests/venue_buffer_foundation.sql`, except the replay check
in `backend/supabase/tests/run_change_request_review.sh`.

| ID | Type | What is tested |
|---|---|---|
| AC-047.4.1 | Integration Test - Happy path | New venues default both durations to zero |
| AC-047.1.1 | Integration Test - Happy path / Negative / Boundary | Independent valid durations are stored; negative, non-multiple-of-15 and null values are refused |
| AC-047.2.1 | Integration Test - Happy path / Boundary | Customer example, zero buffers, cross-day periods and non-overlapping adjacent half-open ranges |
| AC-047.2.2 | Integration Test - Negative | Internal calculation refuses invalid event times and buffer durations |
| AC-047.1.2 | Integration Test - Negative / Regression | Browser cannot change inactive settings or execute the helper; ordinary venue edits remain available |
| AC-047.4.2 | Integration Test - Regression | Replaying 0074 preserves populated venue, booking and occupied-cell records |

The temporary browser-write restriction is a foundation safeguard, not the final
Venue Staff configuration behaviour. Update that case when the configuration flow
is enabled. Next unused IDs: AC-047.1.3, AC-047.2.3, AC-047.3.1, AC-047.4.3.

Verification: full disposable database suite passed, including all six foundation cases and existing concurrency checks. Evidence: [database log](../test-evidence/us47/foundation-database.log). No frontend changed;
no browser checks or shared-Supabase deployment claimed. Shared evidence sheet
has not yet been updated for this portion.
