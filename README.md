# ConnectSphere — Event Planning and Venue Booking

SMU IS212 team project. React + TypeScript front end on Supabase (PostgreSQL, Auth, Row
Level Security).

Implemented so far: **US-005 — submit an event request**.

In progress: **Save Draft Event Request**. Draft validation and the save/update
service are connected to Save Draft on the event form. Repeated saves reuse the draft ID,
and explicit submission updates that same request. My Drafts lists saved drafts and
opens them in the existing form for editing. Automated tests use mocks; browser/live
database verification and draft access-policy work remain pending.

## Prerequisites

- Node.js 22+
- A Supabase project (free tier is enough)
- Optional: the [Supabase CLI](https://supabase.com/docs/guides/cli) for applying
  migrations from the command line

## Setup

All npm commands run from `frontend/`:

```bash
cd frontend
npm install
cp .env.example .env    # Windows: copy .env.example .env
```

Fill in `frontend/.env` from **Supabase dashboard → Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

`.env` is gitignored. Never put the `service_role` key in it — anything prefixed `VITE_`
is compiled into the browser bundle.

## Applying the migration

**Option A — dashboard (no CLI).** Open SQL Editor in your Supabase project, paste the
contents of [`backend/supabase/migrations/0001_events.sql`](backend/supabase/migrations/0001_events.sql)
and run it. The script is idempotent, so re-running it is safe.

**Option B — Supabase CLI.** The CLI looks for a `supabase/` folder in the current
directory, so run it from `backend/`:

```bash
cd backend
supabase link --project-ref <your-project-ref>
supabase db push
```

Apply migrations **in order**, `0001` through `0034`, including both `0005` files
before `0006` and `0019a` straight after `0019`. All are safe to replay; see
[Shared Supabase state](#shared-supabase-state-5-october-2026). The two files currently share a version prefix, so the CLI path above
needs that version collision resolved before it can be relied on; use the SQL Editor
for the existing sequence in the meantime.

### Change-request database baseline

[`0007_event_change_requests.sql`](backend/supabase/migrations/0007_event_change_requests.sql)
records the existing US6 change-request table, four access policies and automatic
`updated_at` trigger from the shared Supabase exports. It stores proposed changes
separately from `events`; applying it does not approve requests or update event details.
It contains no exported test records. On an existing installation, it preserves rows
and recreates the named policies/trigger; `CREATE TABLE IF NOT EXISTS` does not repair
differences in an existing table's columns or constraints. Check the existing schema
before applying it. Authenticated SELECT/INSERT/UPDATE privileges are explicit, and
the coordinator policy uses the project's `current_user_role()` helper.

This is a baseline, not completed US7 security or review functionality. Coordinator
assignment, individual decisions/partial approval, clarification, notifications and
arrangement revalidation remain to be implemented. The baseline policies also do not
prevent forged review fields on insert, edits to other columns during withdrawal,
ineligible event statuses, or duplicate pending requests. Those protections need a
follow-up migration and authenticated database tests. An index enforcing uniqueness
is not included because the supplied exports did not include index definitions.

The supplied live event-read policies also differ from `0005_request_status.sql`:
coordinators currently see drafts in that export. This migration does not replace
event policies or reconcile that separate discrepancy. Do not rerun all earlier migrations on the shared database merely to install this baseline.
(Superseded on 5 October 2026: every migration was replayed deliberately; see
[Shared Supabase state](#shared-supabase-state-5-october-2026).)

Verification on 21 September 2026: applied all repository migrations in order to a
disposable PostgreSQL 17 container, then passed 19 SQL assertions covering RLS setup,
owner/coordinator/anonymous access, invalid inputs, withdrawal, unchanged event records,
and preservation of request values when rerunning `0007`. Supabase's `auth.users`,
`auth.uid()` and database roles/default grants were represented by a local test setup;
this exercised real PostgreSQL policies and constraints, not the live Supabase Auth/API.
These were one-off local checks, not new Vitest cases or checks added to CI. The existing
211 application tests also passed. Live Supabase verification and the security gaps
listed above remain separate follow-up work.

## Organiser-facing review labels (26 September)

Event requests display **In review** to organisers immediately after submission and
throughout coordinator review. Returned event requests show **Clarification required**
when submitted with an outstanding review note, including on home/list badges. Draft
and final outcome labels are unchanged. Submission confirmation/guidance use the same
wording. Change requests also display **In review** for internal status `submitted`.
Database status values and staff labels are unchanged. A follow-up in this PR removes
US4's Start review button: submitted requests offer Approve, Reject and Return for
more detail immediately. Apply migration `0012_review_submitted_event.sql` before
using those direct decisions. See [the direct-review change log](docs/direct-event-review.md).

This presentation change reuses the existing status-panel, submission and change-list
cases; no new test IDs are allocated. Request summaries now include the existing
`review_note` column so list badges can distinguish clarification from review.

## US7 review rules and service

### Shared database status-rule correction

Live setup correction (25 September): the shared table retained an older CHECK
constraint named `event_change_requests_status_valid`, which only allowed four
statuses. Migration `0008` replaced `status_check`, so the legacy rule still blocked
clarification and partial approval. Apply
[`0011_change_request_legacy_status_constraint.sql`](backend/supabase/migrations/0011_change_request_legacy_status_constraint.sql)
after `0010` to consolidate both names into the six-status constraint without changing
rows or access policies. The UI's generic validation message did not identify this
database setup mismatch. Jaydon reported applying `0008`, `0010` and `0011` to shared
Supabase and successfully saving a field clarification on 25 September. Organiser-side
visibility and the other live review paths still need verification.

The database runner now reproduces the legacy constraint before applying `0011`
twice. Three additional checks in `backend/supabase/tests/change_request_legacy_status_constraint.sql`
verify partial approval (`AC-007.5.38`), clarification (`AC-007.7.36`) and preservation
of all request rows on repeated application (`AC-007.13.6`). These **68 local database
checks passed** before the reply increment described below. These checks supplement the 37 UI tests below.

The coordinator review screen is now connected on `/requests/:id`, in Requested
changes. See [the UI change log and all 37 new test cases](docs/us7-review-ui.md) for
the files changed, testing instructions and remaining work. This is still a partial
US7 implementation: organiser replies, notifications and arrangement revalidation
are not complete.

`src/features/events/changeRequestReviewValidation.ts` prepares a review without
reading or writing Supabase. It reuses US6's `ProposedEventChanges` field names.
Every proposed field must appear exactly once as approved, rejected or
clarification_requested. Rejected fields need reasons and clarification fields need
questions. If any field needs clarification, all decisions are provisional and no event
values are prepared or applied. Only a review containing exclusively approved/rejected
fields can finalise as approved, partially_approved or rejected. The legacy whole-request
`action: clarify` payload is still accepted for compatibility; the planned checklist uses
`action: decide` with a separate decision and note for each field.

`changeRequestReviewService.ts` now calls this helper before saving through migration
`0008`'s database review operation, extended by `0010`. Review UI integration, notifications and arrangement
revalidation remain. Checking the proposal's shape here
does not establish that a proposed date or attendance is valid; the database operation
validates the event produced by the accepted subset before saving it.

The original 19 automated tests in
`src/features/events/__tests__/changeRequestReviewValidation.test.ts` use the agreed
`AC-007.Y.Z` format and the AC order in the supplied Jira export:

| Criterion | Case IDs | Coverage in this step |
| --- | --- | --- |
| 5 — approve/reject, including agreed clarification #104 | AC-007.5.1–AC-007.5.12 | Full/partial decisions, missing/duplicate decisions and malformed proposals |
| 6 — rejection reason | AC-007.6.1–AC-007.6.2 | Explanation required and retained per rejected field |
| 7 — request clarification | AC-007.7.1–AC-007.7.3 | Follow-up message, no approved values, incompatible actions rejected |
| 9 — apply only approved values | AC-007.9.1–AC-007.9.2 | Prepared values preserve explicit false/empty values and do not mutate input |

These tests cover pure logic, not completed ACs or communication to the organiser.
If Jira criteria are reordered, update the mapping with the team before adding cases.

### US7 review service

`saveChangeRequestReview(request, eventUpdatedAt, input)` sends decisions or a
clarification message to `review_event_change_request`. Supply the exact `updated_at`
of the event displayed to the reviewer; do not refresh it just before saving. The
service sends no proposed event values or reviewer identity. The database remains
responsible for current assignment, request state, resulting-event validation and
atomic writes. Stale/denied reviews show a reload message; a lost response asks the
user to check the saved status before retrying, since the transaction may have committed.
The coordinator review form calls this service. Shared Supabase has not been updated
by this UI change. Field-level clarification requires migration `0010` after the preceding
migrations, applied through the team's database process.

The original 18 mocked tests in `src/features/events/__tests__/changeRequestReviewService.test.ts`
use these additional IDs, preserving the earlier unit and SQL allocations:

| Criterion | Case IDs | Coverage |
| --- | --- | --- |
| 2 — assigned coordinator | AC-007.2.19–21 | Missing/expired session and server permission denial |
| 5 — decisions | AC-007.5.20–27 | Full/partial approval, incomplete decisions, stale/already-decided request, failure handling |
| 6 — rejection reason | AC-007.6.5 | Blank explanation blocks saving |
| 7 — clarification | AC-007.7.7–8 | Message-only action and required explanation |
| 9 — approved values | AC-007.9.12–14 | Comparison version required and invalid resulting event rejected |
| 10 — rejection | AC-007.10.2 | Full rejection uses the RPC without direct event writes |

These tests verify the service contract, not live database permissions.

CI supplies placeholder `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values to
both the Test and Build steps. The existing US4 `ReviewActions` tests mock the review
function but import the original service for its messages, which also initialises the
Supabase client. The placeholders allow that import without a local `.env`; they do
not provide a working database connection or turn mocked tests into integration tests.
The proposed additional Supabase mock in that test file was not adopted. US4 application
behaviour and test expectations remain unchanged.

### Field-level clarification

`0010_change_request_field_clarification.sql` replaces the review function without
rewriting migration `0008` or existing data. For example, two approved fields, one
rejected field and one clarification field are saved together in `field_decisions`,
but the request remains `clarification_requested` and the entire event (including
`updated_at`) stays unchanged. Blank questions, duplicates and missing/extra fields
are refused. `reviewed_by`/`reviewed_at` identify the latest review action, not proof
that the request has reached a final outcome. Field questions live in each decision's
`note`; `review_note` is retained for legacy whole-request clarification.

Only a submitted request can be reviewed. A request awaiting clarification cannot
be finalised by repeating the RPC call. Migration `0013_change_request_replies.sql` now provides the organiser reply operation.
It retains questions/responses and returns the request to submitted without changing
the event. Request versions prevent stale replies and stale coordinator decisions.
The organiser reply UI and shared answer-history display are now connected. Live
verification is still pending.
Do not bypass it with a direct browser status update.

Implemented organiser labels: Submitted → In review; Clarification requested →
Clarification required; Approved / Rejected / Partially approved are final outcomes.
Withdrawn remains a separate historical outcome.

This step adds 11 application tests (validator now 27; service now 21) and 18 SQL checks:

| File | New case IDs | Coverage |
| --- | --- | --- |
| `changeRequestReviewValidation.test.ts` | AC-007.7.9–16 | Mixed decisions, separate questions, required notes, complete field coverage and input preservation |
| `changeRequestReviewService.test.ts` | AC-007.7.17–19 | Field payload retained, empty question blocked, inconsistent server outcome rejected |
| `backend/supabase/tests/change_request_field_clarification.sql` | AC-007.2.22–23; .7.20–30; .8.1–2; .9.15; .13.4 | Permissions, provisional decisions, unchanged event, final-only application and recorded actor/time |
| `backend/supabase/tests/run_change_request_review.sh` | AC-007.13.5 | Migration rerun preserves provisional and final decisions |

Verified for this step: **276 application tests and 65 disposable-database checks
passed**, along with TypeScript checking and the production build. Lint has no errors;
the existing review-page hook dependency warning and build bundle-size warning remain.
This is local verification, not deployment to or testing against shared Supabase.

### US7 database review operation

[`0008_change_request_review.sql`](backend/supabase/migrations/0008_change_request_review.sql)
adds `events.coordinator_id` and `event_change_requests.field_decisions`, plus
`partially_approved` and `clarification_requested` request statuses. Existing events
start unassigned; there is no automatic assignment or assignment screen in this change.
Originally an Operations Manager called the assignment function. US17 migration `0038`
moves `assign_event_coordinator(p_event_id, p_coordinator_id)` to Coordinator Lead only.
Direct attempts by other signed-in roles to change that field are blocked.

`review_event_change_request(p_request_id, p_event_updated_at, p_review)` accepts the
same `action: decide` / `action: clarify` structure as the TypeScript validator. Pass
the event's `updated_at` from the comparison screen as the expected version. The
function locks the event and request, checks the current assigned coordinator and
pending status, and rejects stale event details. It loads proposed values from the
stored request (never from the reviewer), applies only approved fields, and stamps
the decisions, actor and time in the same transaction. An error rolls back both writes.
Rejected fields require explanations; clarification stores its message and changes no
event details. Timestamps without offsets are interpreted in Singapore time.

This is **change-request** review, separate from US4's original event approval.
US4's event-status actions are preserved. Direct browser edits of submitted event
details are now blocked, so updates to those details must use the review operation.
Draft editing/submission remains allowed. Change-request access is restricted to its
organiser and the assigned coordinator; insert/update column permissions prevent
spoofed reviewer metadata and proposal edits during withdrawal.

The function validates the resulting required fields, date interval and attendance,
but does not yet classify significant changes, flag arrangements for revalidation,
send notifications, or provide clarification-response/resubmission UI. It does not
change event lifecycle status or implement a full audit-history screen. The existing
US6 UI still blocks confirmed events and needs its eligibility rule corrected during
integration. Duplicate pending-request prevention remains a client precheck, not a
database uniqueness guarantee. Reconcile these dependencies before calling US7 done;
the review UI can be tested with existing requests in an assigned event. This migration
has only been verified here against disposable local databases.

Run the database checks with Docker Desktop running:

```bash
bash backend/supabase/tests/run_change_request_review.sh
```

The script creates a disposable PostgreSQL 17 container, applies the migrations,
runs `backend/supabase/tests/change_request_review.sql`, and replays `0008` then `0010` to
verify record preservation without leaving the old RPC installed. It then runs
`change_request_field_clarification.sql` and reruns `0010` to check preservation of
provisional decisions. It removes its container on exit, opens no host ports and never reads
`.env`. `backend/supabase/tests/bootstrap.sql` simulates Supabase Auth identities and grants;
RLS/constraints/functions run in PostgreSQL, but live Supabase Auth/API is not tested.
Do not run these fixture files in shared Supabase. They are not part of `npm test`; CI's
`database` job runs this script on every push.

At the original database-foundation checkpoint: **47 SQL checks** (43 US7 checks and 4 shared-workflow regressions),
plus **230 application tests**, lint and production build. SQL case IDs continue the
unit-test allocations: AC-007.2.1–18, .5.13–19, .6.3–4, .7.4–6, .9.3–11, .10.1,
and .13.1–3. Four `REGRESSION-US1/US4/US6` checks protect other stories rather than
claiming additional US7 ACs. Coverage includes access, reassignment, partial decisions,
invalid/stale reviews, a forced final-save failure with rollback, and rerun preservation.
Concurrent sessions have not yet been exercised by this suite.

## US4 review decisions and notifications (AC-004.4, AC-004.5)

Migration `0009_review_decisions.sql` (run after `0008`) adds two tables, both written only
by the `events_record_review_decision` trigger, which fires after an event's status change
has passed every existing transition rule:

- `event_review_decisions` retains every approve, reject and return with its reason, the
  reviewer (`decided_by`, plus a `decided_by_name` snapshot) and time. The event row's
  `review_note`/`reviewed_by` hold only the latest decision; this table is the trail.
  It is append-only (no write privilege for any signed-in role) and readable only by
  coordinators and operations managers, matching 0005's rule that reviewer identity is
  internal. Coordinators see it on the request page under **Decision history**.
- `notification_outbox` queues the organiser's email for approvals and rejections in the
  same transaction as the decision. No browser role can read it. Returns are logged but
  not emailed, because AC-004.4 names approved/rejected; widening that is one line in the
  trigger.

Emails are sent by the Edge Function `backend/supabase/functions/send-review-notifications`, which
sends through the project Gmail account over SMTP (port 465; Supabase blocks 25 and 587).
Gmail needs no custom domain and can reach any organiser's address. The credentials live
only in Supabase secrets, never in the browser bundle. To enable it:

1. On the Gmail account, turn on 2-Step Verification, then create an app password
   (Google Account → Security → App passwords). Use that 16-character password, not the
   account password.
2. Deploy and configure:

```bash
supabase functions deploy send-review-notifications
supabase secrets set GMAIL_USER=connectsphere212@gmail.com GMAIL_APP_PASSWORD=<app password>
```

3. Add a Database Webhook (Dashboard → Database → Webhooks) on **INSERT** into
   `public.notification_outbox` that calls the function.

The function claims each row before sending, so repeated or overlapping calls do not send
duplicates, and it retries a failed send up to five times; the reason for a failure is
kept in `last_error`. Gmail allows a few hundred messages a day, well above project needs.

US4 test allocations (all criteria, in Jira order):

| Criterion | Unit tests (Vitest) | Database checks |
| --- | --- | --- |
| AC-004.1 — coordinator views full details | AC-004.1.1–.3 (`eventReviewService.test.ts`), AC-004.1.4–.6 (`RequestDetails.test.tsx`) | — |
| AC-004.2 — accept or reject via a button | AC-004.2.1–.16 (`statusRules.test.ts`), AC-004.2.17–.21 (`eventReviewService.test.ts`), AC-004.2.22–.26 (`ReviewActions.test.tsx`) | — |
| AC-004.3 — reason entered in an input box | AC-004.3.1–.2 (`eventReviewService.test.ts`), AC-004.3.3–.5 (`ReviewActions.test.tsx`) | — |
| AC-004.4 — organiser emailed with outcome and reason | — (database behaviour) | AC-004.4.1–.5 |
| AC-004.5 — decision, reason and reviewer retained | AC-004.5.1–.3 (`eventReviewService.test.ts`), AC-004.5.4–.6 (`DecisionHistory.test.tsx`) | AC-004.5.7–.12 |

Actual email delivery through Gmail is verified manually against the live project (the
queued message arrives in the organiser's inbox), since it depends on an external service.

The database checks run against a **disposable** database only:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/review_decisions_test.sql
```

They cover the recorded actor and reason, retention across a later decision, forgery and
editing attempts, organiser visibility, refused transitions, the queued email contents,
and an organiser with no email address. The script rolls back its fixtures.

## Roles

Roles live in `public.profiles.role`, never in `auth.users` — Supabase owns that table and
it cannot take extra columns. Valid values are constrained by `profiles_role_valid`:
`organiser`, `coordinator`, `venue_staff`, `tech_support`, `attendee`.

**Roles are assigned, not chosen.** `prevent_role_self_assignment` blocks a signed-in user
from updating their own role, and no client may insert a profile at all: the
`handle_new_user` trigger (`0005`) creates it in the same transaction as the account, with
the role decided server-side. An administrator assigns roles from the SQL editor, where
statements run without a JWT:

```sql
update public.profiles set role = 'coordinator'
where id = (select id from auth.users where email = 'someone@example.com');
```

Policies read the caller's role through `public.current_user_role()`. That function is
`SECURITY DEFINER` for a reason worth knowing: a policy on `profiles` that queries
`profiles` re-enters itself and Postgres fails with *infinite recursion detected in policy*.
Running as the owner with RLS bypassed breaks the cycle.

Sprint 1 used a **Dev · act as** switcher so one account could try every role. It called
`dev_set_my_role()`, which deliberately reopened the escalation the trigger prevents, and
hiding the switcher in production builds never closed it: the function stayed callable
from the browser console. [`0014`](backend/supabase/migrations/0014_drop_dev_set_my_role.sql)
drops it, so the only way to change a role is now the administrator path above.

### Test accounts

Each role has its own account, so flows that cross roles (an organiser submits, a
coordinator reviews) are tested as two different people, the way RLS will see them.

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter an email and password, and tick **Auto Confirm User**. Without it Supabase
   waits for a confirmation email that a test address can never receive.
3. Assign the role from the SQL editor. Every new account starts as `attendee`, through the
   `on_auth_user_created` trigger (`0042` replaced `0005`'s `organiser` default for US29), so
   every other role, organiser included, is set here:

```sql
update public.profiles p
set role = v.role
from auth.users u,
     (values ('organiser@test.com',   'organiser'),
             ('coordinator@test.com', 'coordinator'),
             ('venue@test.com',       'venue_staff'),
             ('tech@test.com',        'tech_support')) as v(email, role)
where u.email = v.email and p.id = u.id;
```

| Role | Account |
|---|---|
| Event Organiser | `organiser@test.com` |
| Event Coordinator | `coordinator@test.com` |
| Venue Staff | `venue@test.com` |
| Technical Support Staff | `tech@test.com` |
| Attendee | `attendee@test.com` |

Passwords are shared in the team chat, never committed.

> **Note for the oral exam:** the profile used to be created by the browser after first
> sign-in. That raced the session lookup — a new user saw *No organiser profile* until they
> reloaded — and let the client take part in choosing its own role. Creating it in a trigger
> on `auth.users` fixes both: the row exists before any session can, and the client never
> inserts into `profiles`. See [`0005_profile_on_signup.sql`](backend/supabase/migrations/0005_profile_on_signup.sql).

## Running

From `frontend/`:

```bash
npm run dev        # Vite dev server
npm run test       # Vitest, once
npm run test:watch # Vitest, watch mode
npm run coverage   # coverage report for src/features
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # typecheck + production build
```

## Project structure

```
frontend/                            React app (Vite, Tailwind, Vitest)
├── package.json, vite.config.ts, tsconfig.json, .env
└── src/
    ├── lib/supabase.ts              single Supabase client
    ├── components/ui/               shared presentational components
    ├── components/layout/           app shell, navigation, footer
    └── features/
        ├── auth/                    session plumbing (US-002 owns the real story)
        └── events/                  one folder per backlog component
            ├── types.ts
            ├── validation.ts        PURE functions — no React, no Supabase, no I/O
            ├── useEventRequestForm.ts form state and separate save/submit actions
            ├── draftValidation.ts   incomplete draft validation, separate from submission
            ├── eventService.ts      submits new event requests to Supabase
            ├── eventDraftQueryService.ts lists and loads a signed-in organiser’s drafts
            ├── eventDraftService.ts saves new drafts and updates existing owned drafts
            ├── components/
            └── __tests__/
backend/
└── backend/supabase/migrations/             database schema, RLS, triggers
```

The split follows where code runs, not a separate API server. The browser talks to
Supabase directly, so the backend is the database itself: its schema, its RLS policies
and its triggers. That is why the business rules enforced in `backend/` are the real
control, and the checks in `frontend/` are there for the user's benefit.

Future features (`venues`, `bookings`, `equipment`, `registration`, `notifications`)
become sibling folders under `frontend/src/features/`. The folder name is simultaneously a backlog
component, a C4 component and a directory, so tracing a requirement to its implementation
is one step.

See [CLAUDE.md](CLAUDE.md) for the architecture rules the whole team follows.

## Acceptance criteria → tests (US-005)

| AC | Covered by |
| --- | --- |
| AC-005.1 — capture preliminary information | `validation.test.ts` (`AC-005.1: …`), `EventRequestForm.test.tsx` |
| AC-005.2 — cannot submit with missing/invalid required fields | `validation.test.ts` (`AC-005.2: …`), `EventRequestForm.test.tsx` |
| AC-005.3 — informed on success | `EventRequestForm.test.tsx`, `eventService.test.ts` |
| AC-005.4 — informed on failure, with a reason | `eventService.test.ts` (`AC-005.4: …`), `EventRequestForm.test.tsx` |
| AC-005.5 — unique reference, status Submitted | `eventService.test.ts` (`AC-005.5: …`), `0001_events.sql` trigger |

Every test name begins with the acceptance criterion it covers, so
`npm run test -- --reporter=verbose` prints the traceability matrix.

## Acceptance criteria → tests (Save Draft Event Request, in progress)

Save Draft Event Request is **US-001**. Its criteria follow the Jira order:

| Requirement ID | Acceptance criterion |
| --- | --- |
| AC-001.1 | Save an event request as a draft before submitting it |
| AC-001.2 | Save a draft with incomplete information required for final submission |
| AC-001.3 | Identify a saved draft as Draft status |
| AC-001.4 | Reopen a saved draft and continue editing its information |
| AC-001.5 | Saving or editing a draft does not submit it for review |
| AC-001.6 | Treat the request as submitted only after an explicit submission action |

Each automated case has a unique ID, for example `AC-001.2.1`. The final number
identifies a test case, not another acceptance criterion. IDs are unique across the
story's test files, including each parameterised input row. Within each file, group
tests by criterion and sort numerically by story, criterion, then case number. Keep existing IDs stable
and allocate the next unused number for new cases. Tests spanning several criteria use
one primary ID and name additional criteria in parentheses. Invalid-value and failure
checks support the associated criterion; they are not new customer requirements.

Current automated case ranges:

| Criterion | Case IDs | Count |
| --- | --- | ---: |
| AC-001.1 | AC-001.1.1 through AC-001.1.12 | 12 |
| AC-001.2 | AC-001.2.1 through AC-001.2.22 | 22 |
| AC-001.3 | AC-001.3.1 through AC-001.3.2 | 2 |
| AC-001.4 | AC-001.4.1 through AC-001.4.34 | 34 |
| AC-001.5 | AC-001.5.1 through AC-001.5.4 | 4 |
| AC-001.6 | AC-001.6.1 through AC-001.6.9 | 9 |

Run `npm run test -- --reporter=verbose` to see individual case IDs and results.
Automated tests live in
[`draftValidation.test.ts`](frontend/src/features/events/__tests__/draftValidation.test.ts) and
[`eventDraftService.test.ts`](frontend/src/features/events/__tests__/eventDraftService.test.ts),
with form tests in `EventRequestForm.test.tsx` and draft-submission tests in `eventService.test.ts`.
`eventDraftQueryService.test.ts`, `draftFormValues.test.ts` and `DraftPages.test.tsx`
cover listing, restored values and the list-to-editor workflow.
Tests check validation, services with mocked Supabase responses, and the form with mocked services.
They do not connect to Supabase or prove the complete user flow or RLS enforcement works.

| AC / supporting rule | Current evidence | Remaining checks |
| --- | --- | --- |
| AC-001.2 — allow incomplete required fields | Unit tests accept empty drafts, blank fields and a single supplied date | Save incomplete data to Supabase and reopen it |
| Supplied values respect database constraints | Unit tests reject invalid dates, unordered date ranges, and invalid attendance; include boundary values | Verify constraints against live Supabase |
| AC-001.6 — explicit submission | Form and service tests verify submission uses the saved draft ID and full validation | Verify transition and reference trigger against live Supabase |
| AC-001.1, AC-001.4, AC-001.5 — save/edit without submission | Service and form tests check draft saves, repeated edits, guarded updates and failures | Live database tests |
| AC-001.3 — identifiable Draft | Form and page tests verify Draft indicators after saving and in the list | Browser and live database verification |

Run the draft checks from `frontend/` with:

```bash
npm run test -- src/features/events/__tests__
```

Drafts use the existing `events` table. Empty text, dates and attendance become `null`.
Supplied attendance must be a positive PostgreSQL integer, and an end date must follow
the start when both are supplied. Past dates may remain in drafts; submission still
requires a future start. These validation rules do not save data or change status.

`saveEventDraft(input, draftId?)` accepts the complete form snapshot. Omit the ID for
a new draft; reuse the returned `draft.id` for later saves. Updates filter by ID,
signed-in owner and current Draft status, and never set workflow fields such as status
or reference. Missing input fields clear their stored values, so this is not a partial
patch API. A missing/stale draft returns a failure rather than inserting a replacement.
Network failures are reported without automatically retrying a potentially successful save.

The form keeps its draft ID during the current visit, preserves fields after saves/errors,
and disables editing and both actions while saving/submitting. It uses the shared Draft
badge and clears outdated success messages when values change. `useEventRequestForm`
keeps this state separate from the form markup. Switching accounts remounts the form.
`submitEventRequest(input, draftId?)` validates all submission fields, then updates the
owned draft's latest details and status together; a stale ID never falls back to an insert.
Saved drafts can be reopened through `/drafts` or directly at `/drafts/:id`, including
after refreshing that editor URL. The new-request page does not restore unsaved changes;
use My Drafts to find a request saved before leaving that page.

Before completing the story, verify owner access and coordinator draft restrictions
with authenticated users. The inspected live coordinator policies currently do not
exclude drafts; coordinate the policy change with the request-status work. Record live
test results and review evidence in the team's Jira/test tracker, without treating unit
test success as completion of the story.

## Design decisions worth knowing

- **Validation lives in two places on purpose.** `validation.ts` exists for the error
  message; the database CHECK constraints exist for integrity when something bypasses the
  UI. Defence in depth, not accidental duplication.
- **Business rules run in the client and in Postgres, with no middle tier.** That is the
  Supabase model. The trade-off — no server-side application layer to hold logic that
  cannot be expressed in SQL — is recorded in the C4 documentation rather than left to
  look accidental. If a rule ever needs a server, it becomes one Edge Function.
- **Required fields are not `NOT NULL` columns.** US-001 lets organisers save incomplete
  drafts, so the requirement is enforced by a CHECK keyed on `status` instead.
- **References come from a database trigger**, not the client, so two simultaneous
  submissions cannot mint the same number. The sequence is global, so reference numbers do
  not restart each January.
- **Statuses are stored lowercase** (`submitted`) and rendered from `EVENT_STATUS_LABELS`
  (`Submitted`).

### Loading a saved draft

`getEventDraft(id)` in `eventDraftQueryService.ts` reads one draft using ID, signed-in
owner and Draft status filters. It restores existing field names, converts missing
values to empty inputs, and keeps stored date timestamps unchanged for the editor to
format. Opening a draft performs no write. Missing, inaccessible and submitted requests
share one unavailable message.

`eventDraftQueryService.test.ts` covers loading, incomplete data, filters and failures
using mocked Supabase responses. These checks do not prove live RLS enforcement.
`listEventDrafts()` retrieves owned drafts ordered by most recently saved. My Drafts
(`/drafts`) is linked from organiser navigation, home and the new-request page. It shows
Draft badges, last-saved times and an Untitled draft fallback for unnamed requests.
The resume page (`/drafts/:id`) loads an existing draft into `EventRequestForm`; subsequent
saves and explicit submission retain its ID. Loading never writes or submits anything.
After successful submission, the resume page shows confirmation rather than offering
another save of the same draft. Returning to My Drafts reloads the list.

Both pages provide loading, empty/error and retry states as appropriate. Their access
guard waits for a signed-in organiser and resets loaded state on account changes. Stale
responses from a previous account or draft cannot replace the current editor.
`draftFormValues.ts` restores attendance as text and converts stored date timestamps
for datetime-local inputs, matching the existing submission parser's browser timezone.
This does not enforce Singapore time for users outside Singapore; a consistent
application-wide timezone policy still needs coordination with the submission feature.

The page tests use mocked services and the query tests use mocked Supabase. They do not
prove live persistence, RLS, or trigger behaviour. No fake database is shipped in the app.
There is no autosave: users must save changes before navigating away.

### Organiser reply backend (US7)

Apply `0013_change_request_replies.sql` after `0011` before using this code against
Supabase: organiser and coordinator reads now select `review_version`. This file has
been verified in a disposable PostgreSQL container. Jaydon reported applying it to shared
Supabase on 27 September; the browser reply loop still needs live verification.
Number `0012` is reserved for the separate US4 review PR; `0013` does not depend on it.

`changeRequestReplyService.ts` validates all answers and calls `reply_to_change_request`.
Only the owning organiser can reply, with exactly one nonblank answer per outstanding
field question (or a note for a legacy whole-request question). Replies cannot revise
proposed values. Questions, answers, actors and timestamps are appended to `reply_history`;
this is clarification history, not the complete US7 activity-history feature.
The database rejects a reply if another request for the event is already submitted.
The service never silently retries an uncertain write.

The request version is passed through both query services into coordinator saves.
Older clients can still review a first-round request without it; after an answer has
been saved, a matching version is mandatory. The existing event-version check remains.
This branch does not include the pending status-label/Start review PR.

See [reply change log and test cases](docs/us7-reply-preparation.md). This increment
adds 22 Vitest tests (11 previously prepared validation tests, 9 service tests and
2 review-service tests) and 18 database checks. One existing query test also checks
request-version mapping. Totals: **335 application tests; 86 database checks**.
The reply form and answer-history display are now connected; live verification is next.

The owning organiser can answer each outstanding question in Requested changes. Sending
returns the request for review and retains the questions/answers for both roles. The list
uses **Reload change requests**, which clears unsaved answers, instead of refreshing while
someone types. Failed saves preserve the typed answers and require reload before retry.
The coordinator can read the history above the review form. No new migration beyond 0013
is needed for this UI step. It adds **14 UI tests**, bringing the application total to **349**;
the database suite remains at 86. See the reply change log for each case and the manual
walkthrough. The separate pending status-label PR remains independent.

### Significant-change display (US7 AC11, 27 September)

`changeRequestSignificance.ts` classifies the stored proposal. Start/end date-time,
attendance, room layout, accessibility or equipment requirement fields make the request
significant; other supported fields alone make it ordinary. Room layout and accessibility
are the current mapping for venue requirements. The classifier uses field presence,
including removal of an optional requirement, with no threshold or free-text interpretation.
It assumes proposed_changes is the stored diff; it does not compare historical proposals
against today's event, which may already reflect an approved change.

Both roles see the label and the affected significant fields through ChangeRequestSummary.
The classification describes the request, not which changes were approved; it remains on
rejected and partially approved requests too. No new database column/migration or lifecycle
transition is introduced. The future AC12 database hook must evaluate the accepted changes
itself; a browser label must never authorise or trigger revalidation.

13 new tests (AC-007.11.1–13); **368 app tests pass** with the merged status/reply work.
No SQL changes; the combined database runner still has 95 checks, last verified during
conflict resolution. See [classification changes, tests and walkthrough](docs/us7-significance.md).

### Approved-change revalidation hook (US7 AC12)

Migration `0015_change_request_revalidation.sql` adds a protected pending-work table,
`event_change_revalidations`. The review transaction queues accepted significant fields
on final approval/partial approval only. Dates and attendance flag venue and equipment;
layout/accessibility flag venue; equipment requirements flag equipment. Rejected fields,
ordinary-only approvals and unresolved clarifications create no work. Each request can
produce one row. Queue failure rolls back the review and event update.

Only the assigned coordinator and Operations Manager may read these records; browsers
cannot write them. This is the agreed stub for later booking/equipment integration, **not
actual availability checking or automatic cancellation/rescheduling**. There is no completion
API/worker yet, and no automatic lifecycle transition. No historical decisions are backfilled.
The database derives its flags independently of the AC11 browser label.

Jaydon reported applying 0015 to shared Supabase on 27 September and verified that
approving an equipment change request creates a pending revalidation record. Other live
paths are not claimed as verified by this walkthrough; local SQL coverage is listed below.
All 114 local database checks pass, including 19 new tests of the hook and its
permissions/atomicity/replay behavior. See
[revalidation contract, tests and manual check](docs/us7-revalidation.md). Coordinator
submission notifications and the full change-review activity log remain outstanding.

### US7 notification trigger (AC1 / SCRUM-54)

`backend/supabase/migrations/0016_change_request_notifications.sql` records new change
request submissions and clarification replies for the assigned coordinator. In-app records
are stored in `change_request_notifications`; only the current assigned recipient can read
them. US7 channel configuration is in `change_request_notification_settings`: in-app on,
email off by default. Enabling email queues through the existing `notification_outbox` and
sender without changing US4 behavior. No browser can write records or channel settings.

This increment is the trigger only, as agreed: **no notification UI or new sender**. Record
creation is not proof of end-user delivery. Shared notification ownership/integration and
live delivery verification remain open. Unassigned requests are not broadcast; US17 must
handle notification/backlog when assigning later. No migration has been applied to shared
Supabase by the agent and no live email was sent. All 132 local database checks pass, including 18 new cases. See
[contract and test details](docs/us7-notification-trigger.md).

### US7 retained review-decision history (AC13)

Apply `backend/supabase/migrations/0017_change_request_review_history.sql` before running
this coordinator UI. New review actions preserve their outcome, field decisions, proposed
values, reviewer and time. Expand **Review decision history** below a change request to
see them. Earlier clarification actions survive replies and final review. Tracking starts
when the migration is applied; there is no fabricated historical backfill.

History is readable by the assigned coordinator and Operations Manager, with browser
writes prohibited. The existing organiser clarification conversation remains available.
See [review-history changes and test cases](docs/us7-review-history.md): AC-007.13.12–26
are 15 database checks; .27–31 are five app tests. This increment requires live verification.

## US13 equipment requirements (SCRUM-19)

Apply `backend/supabase/migrations/0024_event_equipment_requirements.sql` after 0023.
The assigned Event Coordinator records catalogue equipment lines for an approved,
planning or confirmed event at `/requests/:id/equipment`, with the Organiser's request
shown alongside. Technical Support sees every line and its notifications at `/equipment`.
Recording reserves nothing. US14 reserves through 0019 and links each requirement with
`booking_line_id`. Removing a requirement, or changing a held line's type or quantity,
cancels the line's reserved allocations.

Tests: AC-013.1–6 have 57 app tests and 56 database checks, giving totals of **446 app
tests** and **203 database checks**. Manual E2E: AC-013.1.25 and .4.19 passed on shared
Supabase (3 October); .6.22 is deferred until US14 can create reservations.
See [test cases and results](docs/test-cases/US13_test_cases.md) and
[design, US14 contract and change log](docs/us13-equipment-requirements.md).

## US14 equipment reservations (SCRUM-20)

Apply `backend/supabase/migrations/0025_equipment_reservations.sql` after 0024. Technical
Support reviews pending essential requirements at `/equipment/reservations`, sees the units free
for each event's window, and reserves through one database function. That function checks the
role, locks per equipment type and re-counts, picks units (venue units first), records who and
when, and notifies the Event Coordinator in-app and by email. Windows run from the day before
the first Singapore day, one day earlier for units held elsewhere, through the return day.

Tests: AC-014.1–13 have 22 app tests and 82 database checks. The concurrency checks use `dblink`.
Totals: **523 app tests** and **323 database checks** (including US18's repair checks). 0025 changes Nicole's 0019 policies
(direct-write lockdown, agreed). See [test cases](docs/test-cases/US14_test_cases.md) and
[design and assumptions](docs/us14-equipment-reservations.md).



## US18 venue suitability (SCRUM-62)

A coordinator picks one of their events at `/venues/suitability`, records its venue
requirements beside the organiser's own words, and sees every venue grouped as
**Suitable**, **Unsuitable** (with every reason) or **Unavailable** (blacked out: booked,
blocked or under maintenance). Searching venues for one of your events shows each result's
verdict. Screens are behind `VITE_FEATURE_VENUE_SUITABILITY`, which is off unless set to
`true` in your own `frontend/.env`.

Migrations, all safe to replay:

| File | Adds |
| --- | --- |
| `0019a_reconcile_venue_columns.sql` | Repairs a hand-edited `venues` table (layout and facility stored as lists) to the migrations' shape; does nothing elsewhere. Runs before 0020. |
| `0020_venue_accessibility_array.sql` | `venues.accessibility` as `text[]`, default `{}` and required. This also fixes US8's accessibility filter on fresh databases. |
| `0021_layout_types.sql` | The layout catalogue (seven standard layouts, a team assumption: the customer never listed them) |
| `0022_venue_layouts.sql` | Capacity per layout (#112); a trigger keeps each venue's primary layout in it; backfill for existing venues |
| `0023_event_venue_requirements.sql` | The coordinator's structured layout, accessibility and facility needs per event. Attendance stays on `events` (#119). |

Design notes: suitability is advice, not a hard block (AC-018.2, #83). Double booking and
blocked slots are refused by the slot ledger. Unavailable outranks unsuitable, but both
reasons are kept. If availability can't be checked, the check fails closed. A venue saved
with a new layout name adds that layout to the catalogue. The alert for booking an
unsuitable venue (`UnsuitableVenueAlert`, `assessVenueForBooking`) is built and tested,
and, since 5 October 2026, showing it in the hold flow is part of US11 (SCRUM-171, now under SCRUM-16).

Test allocation (database checks in `backend/supabase/tests/venue_suitability.sql`,
`venue_shape_repair.sql` and the runner's replay checks; app tests in
`frontend/src/features/venues/__tests__/`):

| Criterion | Database checks | App tests |
| --- | --- | --- |
| AC-018.1 — identify suitable venues | AC-018.1.1–1.8 | AC-018.1.9–1.35 |
| AC-018.2 — alert when booking an unsuitable venue | — | AC-018.2.1–2.6 |
| AC-018.3 — mark venues failing requirements unsuitable | AC-018.3.1–3.25, AC-018.3.35–3.39 | AC-018.3.26–3.34 |
| AC-018.4 — black out venues taken by bookings or maintenance | — | AC-018.4.1–4.13 |

## US12 Block Venue Availability (SCRUM-14)

Venue Staff can block a venue for one or more slots (AM, PM, Night) on one date or a range
of up to 366 days, with a reason. Before saving, they preview the bookings and existing
blocks it would overlap. Bookings inside a new block are **flagged for review, not
cancelled** (Week 7 change 2): each one's coordinator is emailed and sees it under **Venue
alerts**, and a flagged booking cannot be approved until the block is removed or the
booking ends. Removing a block keeps it on record with who removed it and when. Screens
(**Venue blocks** for Venue Staff, **Venue alerts** for coordinators) are behind
`VITE_FEATURE_VENUE_BLOCKS`, which is off unless set to `true` in your own `frontend/.env`.

Migrations, all safe to replay (the runner replays 0026–0034 and checks no data changed):

| File | Adds |
| --- | --- |
| `0026_venue_closures_lock_writes.sql` | Revokes direct browser writes to `venue_closures` and to `maintenance` cells, so blocks change only through the functions below |
| `0027_venue_block_validation.sql` | `block_venue()` and its shared request checks: Venue Staff only, a real non-retired venue, dates in order, at most 366 days, valid slots, a reason |
| `0028_venue_block_cells.sql` | `venue_closures.slots` and `created_by_name`. A saved block writes one `maintenance` cell per date and slot to the slot ledger. Drops 0018's date-only `no_overlapping_closures`. |
| `0029_venue_block_preview.sql` | `preview_venue_block()`: the booking cells and existing blocks a block would overlap, without writing |
| `0030_venue_block_flags.sql` | `venue_booking_flags`. A block over bookings flags them instead of failing, releases lapsed holds on the venue, and queues one email per flag. |
| `0031_venue_block_flag_access.sql` | Who reads flags: Venue Staff all of them; a coordinator those on their events and those sent to them; nobody writes them from the browser |
| `0032_venue_block_triggers.sql` | A flagged booking cannot be confirmed (`23514`); a cell a booking frees inside a block goes to the block; a booking that ends resolves its flags |
| `0033_venue_block_removal.sql` | `remove_venue_block()` with `removed_at`/`removed_by`: soft removal that frees the block's cells and resolves its flags |
| `0034_venue_block_skip_removed.sql` | Removed blocks no longer count as overlaps, appear in the preview, or take back freed cells |

Design notes: the slot ledger's primary key (venue, date, slot) is the hard block, so a
booking, its setup and turnaround, and a block can never share a cell, whoever writes
first. Blocks change only through `security definer` functions with `search_path = ''`,
executable by `authenticated` only, so none can skip flagging and notification. Saving a
block, its cells, its flags and its emails is one transaction. A booking already confirmed
when a block lands stays confirmed and flagged; only the step to `confirmed` is refused.
A preview counts only for the venue, dates and slots it checked. Showing blocked slots on
an availability calendar (part of AC-012.4) is US19's job; the blocks page lists them with
their reasons.

Test allocation (database checks in `backend/supabase/tests/venue_blocks.sql`, plus the
runner's replay check AC-012.10.4; app tests in `frontend/src/features/venues/__tests__/`
and `frontend/src/components/layout/__tests__/TopNav.test.tsx`):

| Criterion | Database checks | App tests |
| --- | --- | --- |
| AC-012.1 — only Venue Staff can block | AC-012.1.1–1.7 | AC-012.1.8–1.12 |
| AC-012.2 — one or more slots, on one date or a range | AC-012.2.1–2.11 | AC-012.2.12–2.30 |
| AC-012.3 — a reason is required | AC-012.3.1–3.3 | AC-012.3.4–3.7 |
| AC-012.4 — blocked slots show, with the reason for Venue Staff | AC-012.4.1–4.2 | — |
| AC-012.5 — no new booking on a blocked slot, including setup and turnaround | AC-012.5.1–5.5 | — |
| AC-012.6 — other slots and dates are unaffected | AC-012.6.1–6.2 | — |
| AC-012.7 — overlaps are previewed before saving | AC-012.7.1–7.5 | AC-012.7.6–7.14 |
| AC-012.8 — overlapping bookings are flagged, not cancelled, and coordinators notified | AC-012.8.1–8.13 | AC-012.8.14–8.25 |
| AC-012.9 — current blocks can be viewed and removed | AC-012.9.1–9.11 | AC-012.9.12–9.25 |
| AC-012.10 — who blocked, and when, is recorded | AC-012.10.1–10.4 | AC-012.10.5–10.6 |

## US17 - Coordinator assignment

Coordinators see **Assigned to me** first on the Requests page, followed by **Other
event requests**. Assigned cards show **Assigned to you**. Refresh/polling updates
the groups after reassignment, preserving ordering within each group. This is a
display change only; database permissions still control access. AC-017.4.6 covers
the grouping and refresh behaviour.

Migration `0038_coordinator_lead_assignment.sql` adds the `coordinator_lead` role,
non-draft event read access, and Lead-only assignment through the existing function
and guard. Drafts, null targets and non-coordinator targets are refused; a coordinator
can hold multiple events. Existing accounts are not automatically converted, and
unrelated Operations Manager permissions are retained.

Migration `0039_coordinator_reassignment.sql` prevents reassignment of completed/cancelled
events and restricts coordinator event updates to the current assignee. It records future
Lead assignment changes in `event_coordinator_assignment_history`, readable by Leads only.
Browser users cannot write history; failed changes and unchanged assignments add no entries.
Existing assignments and administrator SQL repairs are not backfilled as Lead actions.

Slice 3 now gives Leads an Assignments navigation link and a submitted/unassigned queue
at `/requests`, with reference, name, purpose, type, Singapore start/end times and attendance.
Drafts, assigned requests and closed events are excluded from that queue. The coordinator
dropdown now shows names and active event counts and saves through the existing assignment
RPC, with error/retry feedback and a refreshed queue/counts on success. Apply migration
`0041_coordinator_assignment_options.sql` before live dropdown testing; deployment is not
yet confirmed. An Assigned events section now shows the current coordinator and allows
reassignment of active events; saving requires a different coordinator. Completed/cancelled/
rejected events are excluded. Live acceptance and notifications remain pending. The AC's withdrawn-event wording needs
mapping to the team's event lifecycle; there is no separate `withdrawn` event status.
Apply the reviewed migration after `0037`, once per shared environment; it has only
been tested in disposable PostgreSQL during this slice. An administrator must provision
a Lead account before assignment testing; the old Manager role no longer assigns.

Jaydon confirmed applying 0039 to shared Supabase on 6 October 2026. Treat it as deployed
and immutable; further database changes require a new claimed migration. Coordinators now
need assignment before original-request review, including US4's existing update path.

Slice 4: `0046_coordinator_assignment_notifications.sql` records notifications for the
new coordinator and organiser from each Lead assignment-history entry, and queues
emails in the existing `notification_outbox`. Both channels default on in the
administrator-only `coordinator_assignment_notification_settings` table. Settings apply
to future notices; replaying the migration preserves configuration. Recipient-only
reads also require current event access. No browser writes, sender changes, historical
backfill or inbox UI are included. Accounts without email retain their in-app record.
The unchanged AC-017.5.1 passes in the full disposable SQL suite. Additional regression
cases AC-017.5.2–3 verify reassignment recipients, no-op/failed-write exclusion, recipient
and current-assignment reads, and denied browser writes/outbox access. They passed on
first execution and are not red/green cycles. AC-017.5.4–5 additionally verify channel
combinations, preservation of earlier notices, and replay of 0046 with populated data
and non-default settings. The full SQL suite passed after correcting syntax in the
new test, without feature changes; these are also regression coverage. Actual live
delivery remains unverified.
Jaydon reported 0046 applied to shared Supabase. Record actual email/in-app delivery
separately from these queue assertions.
Jaydon previously reported slice 3's manual UI checks passed; repeat affected flows
after this slice rather than treating the earlier pending-live wording as current.

Tests: four frontend tests (profile, Lead queue, assignment and reassignment) and 24 SQL cases, with IDs, TDD cycles, additional
coverage and deployment details in [US17 assignment](docs/us17-assignment.md).

US17 equipment handover follow-up: migration `0048_equipment_booking_assignment_access.sql`
makes legacy equipment booking/line permissions follow the current event coordinator,
preserving original requesters and existing Technical Support workflows. It is pending
equipment-owner review and deployment. AC-017.4.4 is the unchanged red/green handover
test; AC-017.4.5 adds regression coverage for requester/reservation protection. Both
run in the disposable database suite. This branch does not include the separate 0047
venue-access PR.

## Shared Supabase state (5 October 2026)

US17 update (9 October): slice 4 merged in PR #72, CI passed, and Jaydon confirmed
0046 applied to shared Supabase. Earlier pending notes describe its development
checkpoints. Live delivery remains unverified. A local-only US17 venue handover
follow-up adds AC-017.4.2 for the old coordinator retaining booking rights. It now
passes unchanged with local migration 0047; the full SQL suite and 864 frontend
tests passed (one TODO). 0047 is not deployed. It transfers booking/slot write
authority to the assigned coordinator, retaining the requester fallback for
legacy unassigned events. Frontend booking filters were updated in the next
TDD checkpoint described below. Coordinate US11/US17 wording with Nicole
before merging that follow-up. See [US17 assignment](docs/us17-assignment.md).
Frontend checkpoint AC-017.4.3 now passes unchanged after its red CI run. Booking
lists use current event assignment; submit/release rely on 0047's write policies
instead of original-requester filters. The full frontend suite has 865 passes
and one existing TODO, and the full SQL suite passes. Four existing venue test
expectations were updated for the proposed rule. Green CI and live acceptance
remain pending; 0047 is not deployed and Nicole's approval is still required.

All migrations `0001`–`0025`, plus the `0019a` repair, were replayed in order on shared
Supabase on 5 October 2026, one transaction per file. No file failed. Before the replay,
every `public` table's data was copied to the private schema `backup_20261005`; drop it
once the team has checked everything (`drop schema backup_20261005 cascade;`).

What the replay found and fixed:

- **Missing access rules.** `venues`, `venue_closures`, `venue_bookings`,
  `venue_slot_claims`, `time_slots` and most of 0019's equipment tables had RLS on but no
  policies, so signed-in users saw no rows. That is why venue search was empty. They now
  have the policies 0018 and 0019 define, so behaviour on shared Supabase matches CI.
- **Hand-edited `venues` columns.** `layout` and `facility` had been changed to text lists.
  0019a converted them back: `layout` keeps its first listed layout, and `facility` becomes
  `{"code": true}`. Any further listed layouts are in the backup and can be re-added as
  `venue_layouts` rows.

Schema changes go through migrations only. Changing a table by hand in the dashboard is
what caused the drift.

US12's migrations `0026`–`0034` were then applied in order on shared Supabase on
5 October 2026, one file per run in the SQL Editor, with a read-only check confirming each.
From then on, Venue Staff cannot write `venue_closures` directly, and a booking with an
open venue-block flag cannot be confirmed.




Latest progress supersedes older remaining-work notes: significance, the revalidation
hook, clarification replies and coordinator notification triggers are implemented. Jaydon
reported a queued email in shared Supabase; delivery is not yet verified. Organiser
notifications are deferred. The story still needs final verification and team review.
