# US48 safety-stage compatibility evidence

Owner: Jaydon. Recorded: 29 October 2026 (Singapore time).
Branch: `us48-safety-stage-replacements`. Claimed migration: 0116.

## Scope

Awaiting safety review and In preparation gain the existing affected-venue replacement
listing/proposal/checked approval flow. There are no frontend source, US27, event-stage,
safety-settings or US45 transition changes. The four replacement/approval definitions
were compared with their current 0099/0102 sources: only the two stage predicates and
a corresponding comment differ. Existing signatures and grants remain supported.

## Passed checks

| Evidence | Result |
| --- | --- |
| `database-focused-retest.log` | Exit 0; all 17 new grouped PostgreSQL integration cases passed, including six concurrent-session race executions across three IDs and populated migration replay. |
| `database-historical.log` | Exit 0; established historical database regressions and existing races passed. This gate deliberately skips 0116. |
| `database-upgrade.log` | Exit 0; quarter-hour upgrade, historical migration replays, existing regression/race checks, US24 checks and the final 0116 safety-stage suite passed. |
| `database-fresh.log` | Exit 0; fresh-order quarter-hour gate with the same final 0116 safety-stage checks passed. |

Commands, each from repository root:

```bash
bash backend/supabase/tests/run_venue_replacement_safety_stages.sh
bash backend/supabase/tests/run_change_request_review.sh
bash backend/supabase/tests/run_venue_time_conversion.sh
bash backend/supabase/tests/run_venue_time_conversion.sh fresh
```

All databases were disposable local PostgreSQL 17 containers with simulated Supabase
Auth interfaces and real permissions, constraints, transactions and concurrent sessions.
They are not live Supabase API/Auth tests. No shared deployment or new manual pass is
claimed. New cases use AC-048 IDs in `docs/test-cases/US48_test_cases.md`; original
US48 evidence remains retained separately. No frontend suite/build run is claimed
for this database-only patch. Shell syntax and changed/new-file whitespace checks passed.
No product source changed after the successful gates; later edits are documentation.

## Initial setup/fixture failure

Docker Desktop was initially stopped; the first invocation could not connect before
any database assertions ran. After starting Docker, the initial focused run reached a
synthetic Organiser fixture missing its required organisation, failing the existing
`profiles_client_org_required` constraint. Corrected the fixture to attach the existing
synthetic organisation and reran successfully. `database-focused-initial.log` retains
the fixture failure; it is not a product defect or failed application requirement.
Forced late-resolution failure in the passing suite is deliberate rollback coverage,
not a product defect. There is no new product-defect sheet entry to invent.
CLI log trailing whitespace and blank EOF lines are normalised without changing text.

## Integration and deployment

Apply the complete 0116 migration after 0099/0100/0102/0108 and current baseline.
Old deliberate replacement/approval replays require 0116 last; both quarter-hour gates
exercise that order. No new frontend contract is required. The shared booking-approval
function keeps ordinary safety-stage bookings refused and enables only the checked,
authenticated replacement link. Inform Jeremiah of this shared function extension;
US45 invalidation/resubmission remains his integration work. No message was sent.

Manual guide: `docs/us48-venue-replacement.md`, current safety-stage section. Existing
21 October manual passes do not establish these new stages. Jaydon owns manual checks,
shared deployment, commits, push, PR, merge and Jira/evidence-sheet updates. Supply
sheet rows in chat; no repository TSV or Automated Test Case Runs entry is created.
