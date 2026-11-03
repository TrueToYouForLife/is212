# US41 arrangement-review loading fix

Owner: Jaydon. Verified: 3 November 2026. Branch: `us41-arrangement-review-loading-fix`.
Base: `292c9af` after the completed venue feature-flag removal merged.

## Confirmed product defect

The assigned Coordinator sees “Arrangement reviews could not be loaded. Please try
again.” on the event detail page, including events with no flags. Yuanlong reported
this on 3 November and said he had logged a defect. An earlier UI precheck independently
observed it; this portion does not invent the existing sheet entry's ID or approval.

US48 migration 0099 added `replacement_booking_id` as a second foreign key from
`arrangement_review_flags` to `venue_bookings`. The frontend's unqualified
`venue_booking:venue_bookings(...)` embed became ambiguous. The deployed schema and
previously shipped selection were reproduced together using real PostgREST 12.2.12
and PostgreSQL 17, returning HTTP 300 / PGRST201. This is not an authorization refusal
or missing assigned-Coordinator fixture. The same metadata ambiguity applies even
when the requested event has no reviews.

[Original query diagnostic](PGRST201-original-query.log) records both relationship
names and the error. The response is from the disposable local API, not a captured
shared Supabase response. It reproduces the actual shipped query; it is not an
unrelated deliberate fault injection or a new test failing before implementation.

## Fix and regression scope

The only application change selects
`venue_bookings!arrangement_review_flags_venue_booking_id_fkey`, retaining the alias
and response shape. Reviews continue to describe the original booking; the replacement
FK remains intact for audit. No database objects, permissions, review reasons or
resolution logic are changed. Strengthened existing unit case AC-041.1.5 and added:

- AC-041.1.13: real API open reasons/resolved history/equipment, with distinct original
  and replacement venues to detect selection of the wrong FK.
- AC-041.1.14: valid empty results for an assigned event without reviews.
- AC-041.1.15: other Coordinator, Venue Staff, Organiser and anonymous access denied.

The standalone runner applies all current migrations in file order to a disposable
PostgreSQL container, reuses the populated replay fixture without replaying migrations,
and adds API-specific rows. A test-only auth.uid stub supports modern JWT claims while
retaining the legacy SQL fixture interface. Actual application RLS/functions run;
JWTs/identities are synthetic, not real Supabase Auth sign-ins. Postgres is the local
connection authenticator, and API requests assume authenticated/anon roles. The API
publishes a random loopback-only port, the database has no published port, and the
runner removes both containers and their private network on exit.

The Node script reads the real service selection and makes HTTP requests. It also
checks the previous unqualified selection still reproduces PGRST201. The CI database
job now installs Node 22 and runs this additional gate; the three existing SQL gates
are unchanged. Docker must be running; the first run needs the pinned PostgREST image.

## Results

| Verification | Result | Evidence |
| --- | --- | --- |
| Disposable API reproduction and final regression | Exit 0; original query HTTP 300/PGRST201, all three corrected-query groups pass | [API log](api-final.log) |
| Frontend service/panel/resolution/indicators/detail-page | 12 tests / 5 files passed | [Targeted](targeted.log) |
| Full frontend coverage | 1,698 tests / 213 files passed | [Coverage](frontend-coverage.log) |
| Typecheck | Passed | [Typecheck](typecheck.log) |
| Lint | Passed | [Lint](lint.log) |
| Production build | Passed, existing bundle-size warning | [Build](build.log) |
| Browser UI | Four read-only groups passed using the configured shared backend | [Actual observations](manual-results.md) |

Coverage: 96.50% statements/lines, 91.29% branches, 94.76% functions.
Frontend count is three lower than the preceding 1,701 because the updated main
removed three feature-flag tests before this branch. This fix removed no frontend test.
US41 now has 25 distinct IDs: eleven frontend, eleven SQL and three HTTP integration.
Global source inventory remains 2,892 / 45 stories: upstream removed three flag IDs
(two US12, one US19) and this portion adds three US41 IDs. Include backend `.mjs`
sources in the index scan. Counts are source references, not runtime executions.

Commands from repository root:

```bash
bash backend/supabase/tests/run_arrangement_review_api.sh
bash -n backend/supabase/tests/run_arrangement_review_api.sh
node --check backend/supabase/tests/arrangement_review_api.mjs
```

Frontend commands ran from `frontend/`: the five targeted files above, then
`npm run coverage`, `npm run typecheck`, `npm run lint`, `npm run build`.
Tests/build used Singapore time and placeholder Supabase URL/key, with the established
network-blocking test setup. No live key/password is stored in logs or this fixture.
No existing full SQL gate was rerun: database schema/functions are unchanged and the
new API gate itself applies every current migration before exercising actual RLS.

## Limits and handoff

No migration or coordinated Supabase deployment is needed. Deploy the updated frontend
after merge. Jaydon owns commit/push/PR/merge; remote CI and Product Owner acceptance
are still pending. No shared record was changed by UI testing. No email delivery or
US48 safety-stage manual pass is claimed. No team message or Google Sheet edit made.
Update Yuanlong's existing defect with cause/fix/retest/evidence; obtain actual review
and approval before filling those fields. Do not create a second entry for the same
product defect or classify the initial stopped dev server as another defect.

All restored assertions passed. Initial API evidence used provisional labels that
were corrected to unused AC-041.1.13–15 before the final run (AC-041.1.12 already belongs
to indicators). No assertion failure or product change resulted from that bookkeeping.
