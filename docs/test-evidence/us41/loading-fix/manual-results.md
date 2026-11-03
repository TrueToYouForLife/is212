# Arrangement-review loading: browser verification

Owner: Jaydon. Date: 3 November 2026. Execution: browser-driven UI verification.
Authenticated account: `coordinator@test.com` (Event Coordinator).
Local frontend: `http://localhost:5173`, branch `us41-arrangement-review-loading-fix`.
The app uses its configured shared Supabase backend. These checks only read records;
no event, booking, review, resolution, assignment or shared setting was changed.

| Check | Steps and observed result | Result | Evidence |
| --- | --- | --- | --- |
| Empty review list and refresh | Open assigned EVT-2026-0025 (Test audit trail), the event from the earlier failure. Arrangement reviews now says “No arrangements are currently flagged for review.” Refresh gives the same result without an alert. | Pass | [Empty reviews](ui-empty-reviews.jpg) |
| Open venue reason and refresh | Open assigned EVT-2026-0020 (Event A). Venue booking — Ampitheatre loads with Needs review, its original booking reference and accessibility reason. Refresh retains the correct reason/name. No resolution saved. | Pass | [Open review](ui-open-review.jpg) |
| Independent venue/equipment reasons and existing history | Open assigned EVT-2026-0012 (new test). Two equipment reasons group under one reservation; venue timing/capacity reasons group under Cinema. Existing equipment resolution history shows its recorded explanation, coordinator and timestamp. No history modified. | Pass | [Resolution history](ui-resolution-history.jpg) |
| Other Coordinator's event | From Other event requests, open EVT-2026-0015 (test significant change), assigned to jaydonlee01. No arrangement-review panel or Save resolution controls are present. The separate change-request review correctly reports assigned-Coordinator access only. | Pass | [Other Coordinator](ui-other-coordinator.jpg) |

The earlier browser check showed the repeatable generic load error on EVT-2026-0025;
[before screenshot](ui-before-load-error.jpg) retains that observation. The actual
PGRST201 response was reproduced in a disposable API test, not captured from live
Supabase developer tools. Role-denial HTTP assertions and a venue review with a distinct
replacement booking are covered in the local API suite, not claimed as additional
shared-data UI scenarios. Full resolution writes and US48 safety-stage E2E were not
performed during these read-only checks.

No manual pass is attributed to a human clicking these steps. No reviewer or Product
Owner approval has been recorded by this verification. Use the existing defect entry
reported by Yuanlong; its number and current sheet contents have not been inspected.
