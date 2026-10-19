# US31 Organiser access within a client organisation (SCRUM-228): test cases

Built in slices (trunk-based development): each slice is its own branch and PR, merged when
CI is green. Slice 1 is the ownership record only — it adds no screen and no read path, so
it has no feature flag.

| Slice | ACs | Status |
|---|---|---|
| 1. Client organisations and Organiser ownership | AC-031.4 | implemented; automated cases pass |
| 2. Colleague read access to the organisation's events | AC-031.1, AC-031.2, AC-031.3 | not started |

The slices are split this way because slice 1 writes to `profiles`, which every role and
every story reads. A backfill against that table lands on its own, verifiable in isolation
and deployable before anything depends on it. AC-031.2 and AC-031.3 are the two halves of
one access rule — who may see an event and who may not — so they stay together in slice 2;
testing either without the other proves nothing.

Test IDs follow `CLAUDE.md`: `AC-031.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-031.1.1, AC-031.2.1, AC-031.3.1,
AC-031.4.17.

## Acceptance criteria (Jira)

- AC-031.1 An Organiser can view and act on the events they are responsible for.
- AC-031.2 Other Organisers in the same client organisation can view those events, but
  cannot edit them, request changes or withdraw them.
- AC-031.3 An Organiser cannot see events of a different client organisation, including
  through search or a direct link.
- AC-031.4 Every Organiser account belongs to exactly one client organisation.

SCRUM-228 records `Depends on: US28`. No US28 exists in the backlog — there is no SCRUM-226
and no issue with that summary — so the line refers to nothing. AC-031.4 is the organisation
ownership that dependency stood for, and this slice implements it; the line should be
removed from the Jira description rather than a story created to satisfy it.

## Design decisions (slice 1)

| # | Decision | Why |
|---|---|---|
| D1 | `profiles.client_org_id` is reused, not added. 0001 declared the column in Sprint 1 and nothing ever read or wrote it. | The column was already reserved for this. Adding a second one would leave a dead column behind and two places to look. |
| D2 | Organisation ownership lives on `profiles`, not on `events`. | Roles already live there, and an event's organisation is derivable through its organiser. A second copy on `events` would eventually disagree with the organiser's. |
| D3 | A CHECK (`role <> 'organiser' or client_org_id is not null`), not `NOT NULL`. | House rule: the column is legitimately empty for Coordinators, Venue Staff, Technical Support and Attendees, who work across clients or for none. |
| D4 | That CHECK is one-directional: an Organiser must have an organisation, a non-Organiser may still hold one. | The stricter reading was implemented first and rejected: it refuses an existing fixture that moves one profile between organiser and coordinator, and AC-031.4 constrains Organisers only. It would also buy nothing, because slice 2 must filter on `role` regardless — role is the authority on what someone may see. AC-031.4.4 pins the decision so tightening it later is a deliberate change with a failing test. |
| D5 | The migration backfills existing Organisers to a default organisation before adding the CHECK, rather than leaving the assignment to be done by hand afterwards. | A CHECK is validated against existing rows the moment it is added, so the constraint would abort on any database that already has Organisers. There is no green state in between. Correcting an individual placement afterwards is a plain `update` and is covered by AC-031.4.13. |
| D6 | A separate guard function, `prevent_client_org_self_assignment()`, rather than extending 0003's `prevent_role_self_assignment()`. | The test runner replays historical migrations; a replay of 0003 would `create or replace` an extended version straight back to the role-only one. A function of its own survives that. |
| D7 | That guard reuses the `app.allow_role_change` setting rather than adding a second switch. | Assigning someone to a client organisation is the same administrative act as assigning their role. Two switches would let an administrator satisfy one and be surprised by the other. |
| D8 | `client_organisations` has a SELECT policy and no insert, update or delete policy anywhere. | Organisations are seed data maintained by an administrator through the service role, matching the team's stance on roles and Organiser accounts (7 October). A write path here would be the one place a user could manufacture their way into another client's events. |
| D9 | An Organiser reads only their own organisation; staff read all of them. | Which other companies are clients of ConnectSphere is not an Organiser's to enumerate — the same instinct as AC-031.3, applied to the organisation list rather than to events. |
| D10 | The foreign key restricts deletes rather than cascading or nulling. | Deleting an organisation that still has Organisers would strip their ownership, and the CHECK would then refuse every later write to those rows. Failing the delete is the recoverable outcome. |

## Automated test cases (slice 1)

Types: **integration (SQL)** runs against PostgreSQL with real RLS.

### AC-031.4 Every Organiser account belongs to exactly one client organisation

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-031.4.1 | 0069 seeds the client organisations the backfill and slice 2 depend on | integration (SQL) | normal | client_organisations.sql |
| AC-031.4.2 | no Organiser anywhere in the database is without an organisation | integration (SQL) | normal | client_organisations.sql |
| AC-031.4.3 | an Organiser cannot be left without an organisation | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.4 | a non-Organiser may hold an organisation — role, not this column, decides access | integration (SQL) | boundary | client_organisations.sql |
| AC-031.4.5 | an Organiser cannot be placed in an organisation that does not exist | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.6 | promoting an Attendee to Organiser requires naming the organisation | integration (SQL) | boundary | client_organisations.sql |
| AC-031.4.7 | an Organiser cannot move themselves into another client's organisation | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.8 | the role guard still refuses a self-change with the organisation guard added | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.9 | an Organiser sees their own organisation and no other client's | integration (SQL) | normal | client_organisations.sql |
| AC-031.4.10 | a Coordinator works across clients and sees the whole list | integration (SQL) | normal | client_organisations.sql |
| AC-031.4.11 | a signed-in user cannot create a client organisation | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.12 | a signed-in user cannot rename a client organisation | integration (SQL) | failure | client_organisations.sql |
| AC-031.4.13 | an administrator can reassign an Organiser to another organisation | integration (SQL) | normal | client_organisations.sql |
| AC-031.4.14 | two client organisations cannot share a name | integration (SQL) | conflict | client_organisations.sql |
| AC-031.4.15 | an organisation with Organisers in it cannot be deleted | integration (SQL) | conflict | client_organisations.sql |
| AC-031.4.16 | replaying 0069 preserves assignments and does not re-run the backfill | integration (SQL) | normal | run_change_request_review.sh |

AC-031.4.2 is deliberately a statement about the whole database rather than about the three
profiles this file creates. `client_organisations.sql` runs late in the runner, after every
other fixture file has created Organisers of its own, so a migration that constrained new
rows but left historical Organisers unassigned would still fail it.

AC-031.4.16 matters more than the usual replay check because the backfill writes to
`profiles`: a replay that re-ran it would drag hand-corrected Organisers back to the default
organisation.

## Evidence

Code-first, with a forced red to show the checks are live rather than vacuous. Weakening
`profiles_client_org_required` to `true` turned exactly one check red —
`FAIL: expected error for AC-031.4.3: an Organiser cannot be left without an organisation`
— and restoring the constraint returned the suite to green.

Full database suite after slice 1: **533 checks, 0 errors** (526 before). No frontend file
is touched, and `tsc --noEmit` passes.

## Fixture changes in other stories' files

The CHECK refuses an Organiser without an organisation, and 24 existing SQL fixture files
create one. Each now sets `client_org_id` in the same statement that sets the role, in four
shapes: a plain `update ... set role = 'organiser'`, a `case id when` block, a
`case when id =` block, and two direct `insert into public.profiles`. Nothing else in those
files changed. This is the visible cost of enforcing AC-031.4 in the database rather than in
the app, and it is the clearest argument for having sliced the story — inside one large PR
it would have been lost among the feature work.

## Not in slice 1

No organisation picker on `/signup`: new accounts are Attendees (0042), and organisers and
staff are seed data with roles set by an administrator (team decision, 7 October). The
organisation is chosen at the moment an administrator promotes someone, which D5's CHECK now
requires them to do in the same statement. An admin provisioning screen has no story yet.

No colleague read path, no `/organisation` route and no service — that is slice 2, which
will add `list_organisation_events()` and `get_organisation_event()` as SECURITY DEFINER
projections rather than widening RLS on `events`, because the column grants in 0005 are
table-wide and would hand colleagues `review_note` and `special_arrangements`.
