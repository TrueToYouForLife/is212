# ConnectSphere — Event Planning and Venue Booking

SMU IS212 Software Project Management (AY 2026/27 Term 1), Team T8. Release 1 of ConnectSphere's
internal system for event requests, coordinator assignment and review, venue search and booking,
equipment reservation, operational safety review, attendee registration and notifications.

**Repository:** https://github.com/TrueToYouForLife/is212 (default branch `main`)

## Contents

- [Tech stack and architecture](#tech-stack-and-architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Setting up a new Supabase project](#setting-up-a-new-supabase-project)
- [Accounts and roles](#accounts-and-roles)
- [Where each role starts](#where-each-role-starts)
- [Running the tests](#running-the-tests)
- [Continuous integration](#continuous-integration)
- [Project structure](#project-structure)
- [Further documentation](#further-documentation)

## Tech stack and architecture

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, React Router 7, React Hook Form with Zod.
  Tests use Vitest and Testing Library.
- **Backend:** Supabase: PostgreSQL (schema, Row Level Security policies, triggers and RPC functions),
  Supabase Auth, and one Edge Function that sends queued notification emails.

There is no separate API server. The browser talks to Supabase directly, so the database itself is
the backend: its RLS policies, constraints and triggers are what enforce the business rules, and the
checks in the frontend are there for the user's benefit.

The C4 model (C1 context, C2 containers, C3 components) and the end-to-end workflow diagrams are in
[docs/architecture](docs/architecture/README.md). Open `docs/architecture/index.html` in a browser to
view and zoom them.

## Prerequisites

- **Node.js 22** and npm (the CI pipeline uses Node 22)
- A **Supabase** project (the free tier is enough)
- **Docker Desktop** and **bash**, only for the database tests (on Windows, use Git Bash or WSL)
- Optional: `psql` to apply migrations from the command line, the Supabase CLI for the email
  function, and Python 3 for the migration checker

## Quick start

1. Clone the repository and install the frontend's locked dependencies:

```bash
git clone https://github.com/TrueToYouForLife/is212.git
cd is212/frontend
npm ci
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env` for the last line.

2. Fill in `frontend/.env` from **Supabase dashboard → Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |

`.env` is gitignored. Never put the `service_role` key in it: anything prefixed `VITE_` is compiled
into the browser bundle.

3. If the Supabase project is new, apply the database migrations first, as described in
   [Setting up a new Supabase project](#setting-up-a-new-supabase-project).

4. Start the app from `frontend/`:

```bash
npm run dev
```

Vite prints the local address, normally http://localhost:5173.

5. Sign in with an account for the role you want to try. See [Accounts and roles](#accounts-and-roles).

## Setting up a new Supabase project

### Apply the migrations

The database is defined entirely by the 125 SQL files in
[`backend/supabase/migrations/`](backend/supabase/migrations), numbered `0001` to `0125`. Apply
**every file, in filename order**. Two files share the number `0005`, and `0019a` comes straight
after `0019`; plain filename order handles both.

**Option A: SQL Editor (no tools needed).** In the Supabase dashboard, open SQL Editor, then paste
and run each file in order.

**Option B: psql.** Copy the connection string from the dashboard's **Connect** button (use the
Session pooler string if your network has no IPv6), then run from the repository root:

```bash
export SUPABASE_DB_URL='postgresql://...'
cd backend/supabase/migrations
for f in $(LC_ALL=C ls *.sql); do echo "$f"; psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" || break; done
```

The loop prints each file name and stops at the first failure. `supabase db push` cannot be used,
because the CLI treats the two `0005` files as the same version.

On 6 November 2026, all 125 migrations applied cleanly in this order to an empty PostgreSQL
database prepared with the same Supabase stand-in the CI uses
([`backend/supabase/tests/bootstrap.sql`](backend/supabase/tests/bootstrap.sql)). This has not
been repeated on a brand-new Supabase project.

To see which migrations an existing project already has, run from the repository root and paste
the output into the SQL Editor (it only reads):

```bash
python3 backend/supabase/scripts/check_applied_migrations.py > /tmp/check_migrations.sql
```

### Starting data

A new database contains the seven room layout types and two client organisations (Northwind
Trading and Harbourline Group), but no venues, equipment or events.

- **Venues:** sign in as Venue Staff and use **Manage venues → Add venue** (`/venues/new`).
- **Equipment:** Release 1 has no screen for creating equipment, so equipment types and units
  have to be inserted from the SQL Editor.
- **Events:** sign in as an Event Organiser and submit a request (`/events/new`).

### Email notifications (optional)

In-app notifications work without this step. Emails are queued in `public.notification_outbox`
and sent by the Edge Function
[`backend/supabase/functions/send-review-notifications`](backend/supabase/functions/send-review-notifications),
which sends through a Gmail account over SMTP. The credentials live only in Supabase secrets,
never in the browser bundle.

1. On the Gmail account, turn on 2-Step Verification and create an app password
   (Google Account → Security → App passwords).
2. Deploy the function and set its secrets:

```bash
supabase functions deploy send-review-notifications
supabase secrets set GMAIL_USER=connectsphere212@gmail.com GMAIL_APP_PASSWORD=<app password>
```

3. Add a Database Webhook (Dashboard → Database → Webhooks) on **INSERT** into
   `public.notification_outbox` that calls the function.

## Accounts and roles

| Role | Database value |
| --- | --- |
| Event Organiser | `organiser` |
| Event Coordinator | `coordinator` |
| Event Coordinator Lead | `coordinator_lead` |
| Venue Staff | `venue_staff` |
| Technical Support Staff | `tech_support` |
| Safety Officer | `safety_officer` |
| Attendee | `attendee` |

The database also accepts `operations_manager`, a legacy title that the Event Coordinator Lead
replaced.

**Roles are assigned, not chosen.** Roles live in `public.profiles.role`. Every new account starts
as an Attendee, created by a trigger on `auth.users`, and a signed-in user cannot change their own
role or organisation. Attendees can therefore sign themselves up at `/signup`. Every other role is
set by an administrator in the SQL Editor, where statements run without a user session. An Event
Organiser must also belong to a client organisation, set in the same statement.

To create test accounts:

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**. Enter an email
   and password and tick **Auto Confirm User**.
2. Assign the roles in the SQL Editor:

```sql
update public.profiles p
set role = v.role,
    client_org_id = case when v.role = 'organiser'
                         then (select id from public.client_organisations
                                where name = 'Northwind Trading')
                         else p.client_org_id end
from auth.users u,
     (values ('organiser@test.com',   'organiser'),
             ('coordinator@test.com', 'coordinator'),
             ('lead@test.com',        'coordinator_lead'),
             ('venue@test.com',       'venue_staff'),
             ('tech@test.com',        'tech_support'),
             ('safety@test.com',      'safety_officer')) as v(email, role)
where u.email = v.email and p.id = u.id;
```

An `attendee@test.com` account needs no update. To try organisation-level access with a second
organiser, add `('organiser2@test.com', 'organiser')` to the list, then move that account:

```sql
update public.profiles set client_org_id =
       (select id from public.client_organisations where name = 'Harbourline Group')
where id = (select id from auth.users where email = 'organiser2@test.com');
```

Passwords are never committed to this repository.

## Where each role starts

After signing in, the top navigation shows only the pages for the account's role. Every role also
has **Notifications** (`/notifications`).

| Role | Main pages |
| --- | --- |
| Event Organiser | New request (`/events/new`), My Drafts (`/drafts`), My requests (`/requests`), Organisation (`/organisation/events`) |
| Event Coordinator | Requests (`/requests`), Venues (`/venues/search`), Availability (`/venues/availability`), Suitability (`/venues/suitability`), My bookings (`/venues/bookings`), Venue alerts (`/venues/alerts`), Equipment catalogue (`/equipment/catalogue`) |
| Event Coordinator Lead | Assignments (`/requests`) |
| Venue Staff | Availability (`/venues/availability`), Booking requests (`/venues/review`), Venue blocks (`/venues/blocks`), Manage venues (`/venues/manage`) |
| Technical Support Staff | Equipment (`/equipment`), Equipment catalogue (`/equipment/catalogue`), Reserve equipment (`/equipment/reservations`), Equipment returns (`/equipment/returns`) |
| Safety Officer | Safety reviews (`/safety-reviews`) |
| Attendee | Open events (`/events/open`), My registrations (`/registrations`) |

## Running the tests

### Frontend unit and integration tests (Vitest)

From `frontend/`:

```bash
npm run test
npm run test:watch
npm run coverage
npm run typecheck
npm run lint
npm run build
```

`test` runs the suite once and `test:watch` reruns it on every change. `coverage` writes a report
for `src/features` to `frontend/coverage/index.html`. `build` runs the typecheck and then the
production build.

Every test name begins with the acceptance criterion it covers (for example `AC-005.2: …`), so
`npm run test -- --reporter=verbose` lists the tests by acceptance criterion.

### Database tests (Docker)

The database rules (RLS policies, constraints, triggers, RPC functions and concurrency) are tested
in SQL against a real PostgreSQL 17. Each runner starts a throwaway Docker container, applies the
migrations, runs the assertions and removes the container. It never connects to a Supabase
project. With Docker Desktop running, from the repository root:

```bash
bash backend/supabase/tests/run_change_request_review.sh
bash backend/supabase/tests/run_venue_time_conversion.sh
bash backend/supabase/tests/run_venue_time_conversion.sh fresh
bash backend/supabase/tests/run_arrangement_review_api.sh
```

These four are the suites CI runs. The other `run_*.sh` scripts in
[`backend/supabase/tests/`](backend/supabase/tests) are focused suites for individual stories and
run the same way.

### Test cases and traceability

- [docs/test-cases](docs/test-cases/README.md): test-case catalogues for each user story, mapping
  acceptance criteria to tests.
- [docs/test-evidence](docs/test-evidence): recorded test runs and coverage evidence.
- [docs/manual-test-run-sheet.md](docs/manual-test-run-sheet.md): manual checks, ordered so they
  can be run in one sitting.

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to any branch and on
every pull request. It has two jobs:

- **verify:** `npm ci`, typecheck, lint, the Vitest suite with coverage (saved as the
  `frontend-coverage` artifact) and the production build.
- **database:** the four Docker-based database suites listed above.

## Project structure

```
.
├── .github/workflows/ci.yml            CI pipeline
├── frontend/                           React app (Vite, Tailwind, Vitest)
│   ├── package.json, vite.config.ts, .env.example
│   └── src/
│       ├── App.tsx                     routes
│       ├── pages/                      home, landing and not-found pages
│       ├── components/                 shared UI and the layout, including role-based navigation
│       ├── lib/supabase.ts             the single Supabase client
│       ├── test/setup.ts               Vitest setup
│       └── features/                   one folder per area: auth, events, venues, equipment,
│                                       registrations, safety, notifications
├── backend/supabase/
│   ├── migrations/                     0001–0125: schema, RLS policies, triggers, RPC functions
│   ├── tests/                          SQL test suites and their Docker runners (run_*.sh)
│   ├── functions/                      send-review-notifications Edge Function
│   └── scripts/                        check_applied_migrations.py
└── docs/
    ├── architecture/                   C4 diagrams and workflows
    ├── test-cases/                     test-case catalogues per user story
    ├── test-evidence/                  recorded test runs and coverage
    ├── implementation-notes.md         per-story implementation notes
    └── us*.md                          story and slice design notes
```

Inside each feature folder, pure rule modules (validation, status rules, slot calculations) hold
no React or Supabase code and are unit-tested directly; services wrap the Supabase calls; pages
and components build the screens; and `__tests__/` holds the tests. A feature folder matches a
backlog area and a C3 component, so a requirement can be traced from Jira to its code in one step.

## Further documentation

- [Architecture and workflows (C4)](docs/architecture/README.md)
- [Implementation notes per user story](docs/implementation-notes.md): the design decisions, migrations
  and verification recorded for each story during development
- [Final-sprint requirement change log](docs/change-log.md)
- [Test-case index](docs/test-cases/README.md)
