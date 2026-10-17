# US52 Enable Registration for an Event (SCRUM-245): test cases

Status: **implemented; all 41 automated cases pass (17 October 2026).** 17 app tests (Vitest) and
24 SQL cases (34 checks) in `registration_setting.sql`, run in a disposable Docker database through
`bash backend/supabase/tests/run_change_request_review.sh` (whole suite, exit 0). The full app suite
is 1145 passing; lint and build pass. `0057` was applied to shared Supabase by Jaydon. The live
browser check below is still to be done. Nothing is committed yet. Code was written before the tests,
at the team's request, so there is no red-green record for this story.

Test IDs follow `CLAUDE.md`: `AC-052.Y.Z`, where Y is the acceptance criterion in Jira order and Z
numbers the tests within it. Z is unique across the story. The SQL file uses `.1.1` to `.1.10`, and
the app tests continue from `.1.11`.

Builds on US15 (`0043_event_registrations.sql`): `events.registration_required` is already the
"registration enabled" flag, and `register_for_event` and `list_open_events` already read it.

## Design the tests assume

| # | Design | Source |
|---|---|---|
| D1 | New migration `0057_event_registration_setting.sql`, one function and no new table or column. | AC-052.1 |
| D2 | The flag changes only through `set_event_registration(p_event_id, p_enabled)`: SECURITY DEFINER, `search_path = ''`, caller is always `auth.uid()`. A direct table update is still refused for the browser by the 0008 guard. | CLAUDE.md |
| D3 | Error codes: `42501` caller is not the assigned coordinator (also used for an unknown event, so ids cannot be probed), `22023` missing on/off value, `22000` event is not Confirmed. | AC-052.1 |
| D4 | Only a Confirmed event can be switched (team decision, 17 October). The UI rule `canChangeRegistration` mirrors it; the database re-checks. | AC-052.1, .3 |
| D5 | The event row is locked `FOR UPDATE`; `register_for_event` reads it `FOR SHARE`, so a registration cannot slip in while the switch is being committed. | AC-052.4 |
| D6 | The Organiser's request sets the starting value through the existing `registration_required` column. No new code; tests record it. | AC-052.2 |
| D7 | "Existing registrations are kept" means no row in `event_registrations` is touched when the flag changes. | AC-052.4 |
| D8 | The Organiser reads the flag through the shared request detail page, labelled "Attendee registration: Enabled/Disabled". This replaced the old "Registration required: Yes/No" row, which showed only the original request. | AC-052.5 |

## Assumptions (to confirm with the team)

| # | Assumption | Tests affected |
|---|---|---|
| A1 | The switch is Confirmed only. Approved and Planning events cannot be switched even though attendees cannot register then anyway. | .1.9, .1.17, .1.24 |
| A2 | A Coordinator Lead and an Operations Manager cannot change it, because only the assigned coordinator may (AC-052.1). | .1.5 |
| A3 | An event whose start has already passed can still be switched while it is Confirmed. Attendees cannot register for it either way, because US15 requires a future start. | none |
| A4 | A change-request approval can also set `registration_required` (0055). It writes the same column, so the Coordinator's switch and an approved change simply overwrite each other. | none |

## AC-052.1 The assigned Coordinator can enable or disable registration for their event

| ID | Type | Case | Result |
|---|---|---|---|
| AC-052.1.1 | SQL | The assigned Coordinator disables registration for a Confirmed event | Pass |
| AC-052.1.2 | SQL | And enables it again | Pass |
| AC-052.1.3 | SQL | Registration the Organiser did not ask for can be enabled | Pass |
| AC-052.1.4 | SQL | A Coordinator who is not assigned is refused (42501) | Pass |
| AC-052.1.5 | SQL | Coordinator Lead, Operations Manager, Organiser, Attendee and a visitor are each refused (42501) | Pass |
| AC-052.1.6 | SQL | An unassigned event and an unknown id are refused the same way | Pass |
| AC-052.1.7 | SQL | A missing on/off value is refused (22023), not treated as off | Pass |
| AC-052.1.8 | SQL | None of the refused attempts changed a stored value | Pass |
| AC-052.1.9 | SQL | Approved, Planning, Cancelled and Completed events are refused (22000) and unchanged | Pass |
| AC-052.1.10 | SQL | A direct table update of the flag by the Coordinator is refused (42501) | Pass |
| AC-052.1.11 | Vitest | The service sends the event and on/off value to `set_event_registration` | Pass |
| AC-052.1.12 | Vitest | A 42501 refusal says only the assigned coordinator can change registration | Pass |
| AC-052.1.13 | Vitest | A 22000 refusal says the event must be Confirmed | Pass |
| AC-052.1.14 | Vitest | Any other error gives a generic message without the raw error | Pass |
| AC-052.1.15 | Vitest | An id that is not a UUID is rejected before any request | Pass |
| AC-052.1.16 | Vitest | A lost response is reported as unconfirmed and not retried | Pass |
| AC-052.1.17 | Vitest | `canChangeRegistration` is true for Confirmed and no other status | Pass |
| AC-052.1.18 | Vitest | With registration on, the panel says so and offers Disable, noting existing registrations are kept | Pass |
| AC-052.1.19 | Vitest | With registration off, the panel says so and offers Enable | Pass |
| AC-052.1.20 | Vitest | Clicking asks for the opposite value, then tells the page to reload | Pass |
| AC-052.1.21 | Vitest | A refusal is shown, the page is not reloaded, and a retry works | Pass |
| AC-052.1.22 | Vitest | A second click while saving sends nothing more | Pass |
| AC-052.1.23 | Vitest | The assigned coordinator sees the switch on a Confirmed event | Pass |
| AC-052.1.24 | Vitest | Another coordinator, organiser, lead, manager, and any non-Confirmed status see no switch | Pass |
| AC-052.1.25 | Vitest | After a successful change the page reloads the event | Pass |

## AC-052.2 Registration starts enabled if the Organiser's request asked for it, disabled otherwise

These three describe behaviour that already existed (D6), so they pass without 0057. They are
regression coverage that pins the rule, not new behaviour.

| ID | Type | Case | Result |
|---|---|---|---|
| AC-052.2.1 | SQL | A request that asked for registration starts enabled | Pass |
| AC-052.2.2 | SQL | A request that did not ask starts disabled | Pass |
| AC-052.2.3 | SQL | A request silent on registration starts disabled (column default) | Pass |

## AC-052.3 Attendees can only register for Confirmed events with registration enabled

Also existing US15 behaviour, recorded here so US52 traces to it. They pass without 0057.

| ID | Type | Case | Result |
|---|---|---|---|
| AC-052.3.1 | SQL | An Attendee registers for a Confirmed event with registration enabled | Pass |
| AC-052.3.2 | SQL | A Confirmed event with registration disabled refuses registration (22000) | Pass |
| AC-052.3.3 | SQL | Approved and Planning events refuse registration even when enabled | Pass |
| AC-052.3.4 | SQL | The open-events list shows only Confirmed events with registration enabled | Pass |

## AC-052.4 Disabling registration stops new registrations; existing registrations are kept

| ID | Type | Case | Result |
|---|---|---|---|
| AC-052.4.1 | SQL | After the Coordinator disables registration, a new Attendee is refused (22000) | Pass |
| AC-052.4.2 | SQL | And the event leaves the open-events list | Pass |
| AC-052.4.3 | SQL | The registration made before disabling is kept, unchanged | Pass |
| AC-052.4.4 | SQL | The registered Attendee still sees it under My registrations | Pass |
| AC-052.4.5 | SQL | Enabling again lets new Attendees register, beside the kept one | Pass |

## AC-052.5 The Organiser can see whether registration is enabled for their event

| ID | Type | Case | Result |
|---|---|---|---|
| AC-052.5.1 | SQL | The Organiser reads the current setting on their own events after the Coordinator changed it | Pass |
| AC-052.5.2 | SQL | And cannot read another Organiser's event (existing RLS, regression coverage) | Pass |
| AC-052.5.3 | Vitest | The request details show registration as Enabled | Pass |
| AC-052.5.4 | Vitest | And as Disabled after the Coordinator switches it off | Pass |

## Other changes in this story

| Change | Where |
|---|---|
| The row label "Registration required" (Yes/No) became "Attendee registration" (Enabled/Disabled). The two existing assertions in `RequestDetails.test.tsx` were updated to the new wording; their IDs (AC-004.1) are unchanged. | `RequestDetails.tsx` |
| `registration_setting.sql` uses the fixture id prefix `53…`, because `structured_event_requirements.sql` already uses `52…`. | tests |

## Manual checks still to do

| Check | How |
|---|---|
| The switch works in the browser against shared Supabase | Sign in as the assigned coordinator, open a Confirmed event, disable then enable registration. |
| The Organiser sees the change | Sign in as that event's Organiser and open the same event. |
| An Attendee cannot register after disabling | Sign in as an Attendee: the event is gone from Browse events, and an earlier registration is still under My registrations. |

Next unused IDs: `AC-052.1.26`, `.2.4`, `.3.5`, `.4.6`, `.5.5`.
