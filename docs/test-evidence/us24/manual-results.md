# US24 manual results

Tester: Jaydon. Report received: 29 October 2026 (Singapore time).
Environment: local frontend on `us24-return-inspection-ui`, connected to shared Supabase.
Source: Jaydon replied "all tests pass" to the eight-group UI checklist in chat.
This records his reported outcome, not an independently observed browser run.

| Group | Manual scenario | Reported result |
| --- | --- | --- |
| 1 | Technical Support loads Equipment returns and refreshes successfully. | Pass |
| 2 | Out list uses saved inclusive dates and offers no inspection action. | Pass |
| 3 | Explicit No issues finding, keep-current status, automatic close, retained history and other units remaining pending. | Pass |
| 4 | Damage/Defect/Other validation, saved findings/status, catalogue status and usable counts. | Pass |
| 5 | Missing forces Unavailable, stays pending, and retains history through explicit follow-up. | Pass |
| 6 | Competing catalogue status edit causes stale refusal; notes remain and explicit reload permits reviewed resubmission. | Pass |
| 7 | Coordinator/Organiser/Attendee navigation and direct-route denial. | Pass |
| 8 | Status change flags affected future reservations, retains reservations/independent reviews and respects notification preferences. | Pass |

Exact fixture/event references, asset tags, account IDs, individual execution times and
screenshots of each pass were not supplied. Optional offline checks, extra boundary
scenarios beyond the eight-group checklist and delivered email are not inferred.

## Deployment/setup issue encountered

The returns page initially failed to load. The API returned HTTP 404 / PGRST202 for
`get_equipment_return_inspections`; a diagnostic query returned NULL for both that
function and `equipment_return_inspections`. Jaydon identified missing lines in his
initial migration paste, reran the complete 0112 migration, confirmed both objects
exist, and subsequently reported all manual groups passed. No product code change
was needed. Classify this as deployment/setup failure, not a product defect.

No additional manual product defect was reported. Frontend PR/CI/merge/deployment,
shared evidence-sheet update and Jira transition remain separate actions.
