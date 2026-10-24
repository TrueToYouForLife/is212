# US33 Choose notification channels by type (SCRUM-230): test cases

Built in slices. Slice 1 is in Sprint 3; the story then returns to the product backlog for
re-estimation before Sprint 4.

| Slice | ACs | Status |
|---|---|---|
| 1. The choices: types per role, two switches per type, on by default | AC-033.1, AC-033.2, AC-033.3 | done (0077) |
| 2a. The sending helper (0079) | AC-033.4, AC-033.5 (helper level) | done |
| 2b. Each feature moved onto the helper (0080 to 0088, 0090 to 0092 and 0103, one PR per function; 0095 fixed 0080) | AC-033.4 per type | done |
| 2c. Email for the four in-app-only types (0093) | AC-033.3 for those types | done |
| 2d. Settings page shows types switched off for everyone; flag removed (0106) | AC-033.2 | done |

Test IDs follow `CLAUDE.md`: `AC-033.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-033.1.9, AC-033.2.12, AC-033.3.8, AC-033.4.31, AC-033.5.2.

## Acceptance criteria (Jira)

- AC-033.1 A user can see the notification types that apply to their roles.
- AC-033.2 For each type, a user can turn in-app and email delivery on or off independently.
- AC-033.3 New users receive every type both in-app and by email until they change it.
- AC-033.4 Notifications are only delivered through the channels enabled for that type.
- AC-033.5 A preference change applies to future notifications only.

Source: clarification #37. The ticket was marked Deferred (not a named core feature; sending both
channels already meets F20). The team chose to deliver the choices now and plan delivery for
Sprint 4.

## Why delivery is a separate slice

The switches are this story's own code. Making delivery follow them is not: today every email
goes through `notification_outbox` with only an address, subject and body, so nothing records
which type a notice is, and about half the in-app feed (US32) is read from that same outbox.
Four types (arrangement reviews, new venue booking requests, venue booking decisions,
equipment requirement changes) are not emailed at all. Three per-type switches already exist,
but system-wide, not per user (`change_request_notification_settings`,
`coordinator_assignment_notification_settings`, `equipment_notification_settings`).

Plan for slice 2: one shared helper, `send_notification(recipient, type, event, subject, body)`,
that checks the recipient's choices and writes the in-app record, the outbox email, both or
neither; then each place that sends a notice calls it, agreed with that feature's owner. That
delivers AC-033.4 for every type, gives the four in-app-only types their email, and applies
choices at the moment a notice is created (AC-033.5).

Places that send notices today (the re-estimation input):

| Type | Sent from | Owner's story |
|---|---|---|
| event_request_decision | 0009 (email) | US4 |
| coordinator_assignment | 0046 (in-app and email) | US17 |
| change_request | 0016 (in-app and email) | US7 |
| arrangement_review | 0052, 0063, 0067 (in-app) | US41, US20, US46 |
| venue_booking_decision | 0051 (in-app) | US10 |
| venue_block_alert | 0030, 0034 (email) | US12 |
| equipment_reservation_outcome | 0025 (in-app and email) | US14 |
| venue_booking_request | 0035 (in-app) | US9 |
| equipment_requirement_change | 0024 (in-app) | US13 |
| registration_update | 0043, 0050 (email) | US15, US23 |
| waitlist_update | 0058 (email) | US16 |

## Design decisions (slice 1)

| # | Decision | Why |
|---|---|---|
| D1 | A catalogue table, `notification_types`, lists each type with the roles that receive it and how it is delivered today. | AC-033.1 is answered by the database; slice 2's helper reads the same table. |
| D2 | Only choices someone has changed are stored (`notification_preferences`); no row means both on. | AC-033.3 for new users and for types added later, with no backfill. |
| D3 | Saving takes both channels for one type, only for a type that applies to the caller's role; choices are private to each user. | AC-033.2, and nobody can set or read another person's choices. |
| D4 | Each switch saves at once; if the save fails the switch goes back and the reason is shown. | No separate Save button to forget; the screen never shows a choice that was not kept. |
| D5 | The page was behind a feature flag until every notice followed the choices (slices 2a to 2c); 2d removed it. | A switch that did not yet change what someone receives would have misled them. |

## Automated test cases (slice 1)

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-033.1.1 | each role sees exactly the notification types it receives, in a fixed order | integration (SQL) | normal | notification_preferences.sql |
| AC-033.1.2 | each type has a name and description; a role with none sees none; signed out is refused | integration (SQL) | boundary | notification_preferences.sql |
| AC-033.3.1 | a new user receives every type both in-app and by email until they change it | integration (SQL) | normal | notification_preferences.sql |
| AC-033.2.1 | in-app and email are switched independently per type; other types keep theirs | integration (SQL) | normal | notification_preferences.sql |
| AC-033.2.2 | changing a type again updates the one choice | integration (SQL) | boundary | notification_preferences.sql |
| AC-033.2.3 | a type that does not apply, an unknown type or a missing choice is refused; nothing saved | integration (SQL) | failure | notification_preferences.sql |
| AC-033.2.4 | nobody can read or change another's choices; one person's choice leaves others on the default | integration (SQL) | conflict | notification_preferences.sql |
| AC-033.1.3 | settings are read in one call with name, description and choices | unit (service) | normal | preferencesService.test.ts |
| AC-033.1.4 | no types is empty; signed out asks to sign in; failures are reported and logged | unit (service) | failure | preferencesService.test.ts |
| AC-033.2.5 | a choice saves both channels for its type in one call | unit (service) | normal | preferencesService.test.ts |
| AC-033.2.6 | a type that does not apply, signed out or a failure is reported | unit (service) | failure | preferencesService.test.ts |
| AC-033.1.5 | each type is listed with what it is for and its two switches | unit | normal | NotificationPreferencesPage.test.tsx |
| AC-033.1.6 | a role with no notifications is told so; a failed load is shown | unit | boundary | NotificationPreferencesPage.test.tsx |
| AC-033.1.7 | signed out or loading, nothing is loaded; leaving early ignores a late answer | unit | boundary | NotificationPreferencesPage.test.tsx |
| AC-033.2.7 | switching email off saves the type with in-app still on, and says it was saved | unit | normal | NotificationPreferencesPage.test.tsx |
| AC-033.2.8 | switches pause while saving; a failed save puts the switch back and says why | unit | failure | NotificationPreferencesPage.test.tsx |
| AC-033.1.8 | the Notifications page links to the settings once the feature is on, and not before | unit | boundary | NotificationsSettingsLink.test.tsx |

## Manual test cases (shared Supabase, after 0077 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | Sign in as a Coordinator and open Notifications, then Notification settings. | Six types, every switch on. |
| M2 | Turn email off for "Change requests to review", reload. | It stays off; the others are unchanged. |
| M3 | Sign in as an Attendee. | Only "Your registrations" and "Waiting list updates". |

## Coverage and forced break

`preferencesService.ts` and `NotificationPreferencesPage.tsx` are at 100%, and
`NotificationsPage.tsx` stays at 100% with its settings link. SQL has no coverage tool; 0077 is
covered case by case above.

Forced break: in `0077_notification_preferences.sql`, `set_my_notification_preference`'s check
that the type applies to the caller's role was removed. AC-033.2.3 failed; the file was then
restored. Log: `docs/test-evidence/us33/AC-033.2.3-forced-break.log`.

## Slice 2a: the sending helper (0079)

### Design decisions

| # | Decision | Why |
|---|---|---|
| D6 | `notification_channels(recipient, type)` is the one place that decides: a channel is used only if the person's choice (on unless they turned it off) and, for change requests, assignments and equipment results, the existing system-wide switch both allow it. | Team decision: people decide day to day; the three system-wide switches stay as an admin kill switch, all on once each feature moves (US7's email switch is turned on in its conversion). |
| D7 | `queue_notification_email` tags each email with its type and recipient; `record_in_app_notice` stores the in-app copy of notices that had none (`user_notifications`); `send_notification` does both. | Converted features call one helper instead of writing notices directly. |
| D8 | Event decisions, venue closures, registrations and waiting-list updates get a separate in-app copy instead of the feed showing their email. | So switching email off does not also hide them in the app (AC-033.2 independence). |
| D9 | The feed shows in-app copies (source `notice`) and leaves out emails sent through the helper; emails from features not yet moved show exactly as before. | Nothing appears twice, and nothing changes until each feature's own PR merges. |
| D10 | In-app copies are read on the user's behalf with their event's name, like their emails. | Attendees cannot read events directly; their notices named the event when they were emails. |
| D11 | The helpers can only be called by the database's own triggers and functions, not from the app. | Nobody can send, inspect or plant a notice. |
| D12 | Choices are read when a notice is created. | AC-033.5: a change affects notices from then on; notices already sent stay. |

### Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-033.4.1 | with no choices made, a notice is emailed and shown in the app once, not twice | integration (SQL) | normal | notification_delivery.sql |
| AC-033.4.2 | email off: only in the app; in-app off: only emailed, and the feed does not show that email | integration (SQL) | normal | notification_delivery.sql |
| AC-033.4.3 | with both off, nothing is sent | integration (SQL) | boundary | notification_delivery.sql |
| AC-033.4.4 | a channel is used only when both the person's choice and the system-wide switch allow it | integration (SQL) | conflict | notification_delivery.sql |
| AC-033.4.5 | one person's choices leave another's untouched | integration (SQL) | boundary | notification_delivery.sql |
| AC-033.4.6 | each email records its type and recipient; unknown type refused; no recipient, nothing queued | integration (SQL) | failure | notification_delivery.sql |
| AC-033.4.7 | nobody can send, inspect or plant a notice from the app, or read anyone else's | integration (SQL) | conflict | notification_delivery.sql |
| AC-033.4.8 | an email from a feature not yet using the helper still shows in the feed | integration (SQL) | boundary | notification_delivery.sql |
| AC-033.4.9 | an in-app copy counts as unread and is marked read like any notice, only by its recipient | integration (SQL) | normal | notification_delivery.sql |
| AC-033.5.1 | turning a type off stops new notices but leaves ones already sent | integration (SQL) | boundary | notification_delivery.sql |
| AC-033.4.10 | an in-app copy is listed with its event and marked read by source and id | unit (service) | normal | noticeSource.test.ts |
| AC-033.4.11 | opening one goes where that role's other notices go | unit | normal | noticeSource.test.ts |

Forced break (slice 2a): in `0079_notification_delivery.sql`, `notification_channels` was made to
ignore the person's own choice (`coalesce(p.in_app, true)` and `coalesce(p.email, true)` replaced
with `true`). AC-033.4.2 failed; the file was then restored.
Log: `docs/test-evidence/us33/AC-033.4.2-forced-break.log`.

## Slice 2b: each feature moved onto the helper

One PR per function, each recreating the function exactly as its latest migration had it and
changing only how it sends its notice. Each was checked against current main before building, so
none overwrites a newer version (0080 did, before 0066 had merged; 0095 restored US22's withdrawal
outcome, and `make_pr.py` gained a guard against it happening again).

| Migration | Story and function | Owner | Tests | Forced break caught by |
|---|---|---|---|---|
| 0080, 0095 | US4 `record_event_review_decision` | Jeremiah | AC-033.4.12, AC-033.4.13, AC-033.4.30 | AC-033.4.12; AC-022.2.11 for 0095 |
| 0081 | US7 `notify_change_request_submission` (email now on by default) | Jaydon | AC-033.4.14, AC-033.4.15 | AC-007.1.9 |
| 0082 | US17 `notify_coordinator_assignment` | Jaydon | AC-033.4.16, AC-033.4.17 | AC-017.5.4 |
| 0083 | US14 `queue_equipment_outcome_notice` | Siew | AC-033.4.18, AC-033.4.19 | AC-014.13.5 |
| 0084 | US13 `notify_equipment_requirement_change` | Siew | AC-033.4.20 | AC-033.4.20 |
| 0085 | US9 `notify_venue_staff_of_booking_request` | Nicole | AC-033.4.21 | AC-033.4.21 |
| 0086 | US10 `notify_venue_booking_decision` | Justas | AC-033.4.22 | AC-033.4.22 |
| 0087 | US20/US41 `record_arrangement_review` | Justas | AC-033.4.23 | AC-033.4.23 |
| 0088 | US46 `record_venue_change_review` | Jeremiah | AC-033.4.24 | AC-033.4.24 |
| 0103 | US12 `save_venue_block_window` (from 0100; replaces 0089) | Jeremiah | AC-033.4.25, AC-033.4.26 | AC-033.4.25 |
| 0090 | US15 `queue_registration_confirmation` | Siew | AC-033.4.27 | AC-015.3.1 |
| 0091 | US23 `queue_withdrawal_confirmation` | Siew | AC-033.4.28 | AC-033.4.28 |
| 0092 | US16 `queue_waitlist_notification` | Siew | AC-033.4.29 | AC-033.4.29 |

Tests are in `notice_channels_*.sql`, run by the main runner's loop (each re-applies its own
migration), except 0103's `venue_block_notice_channels.sql`, run by `run_venue_time_conversion.sh`
after 0100 in both modes.

## Slice 2c: email for the four in-app-only types (0093)

Equipment requirement changes, venue booking requests, venue booking decisions and arrangement
reviews now also email, unless the person turns it off. Emails to Venue Staff and Technical
Support stay generic, as those roles cannot read events.

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-033.3.2 | a new equipment request is emailed to each Technical Support member with email on, without event details | integration (SQL) | normal | notice_channels_zz_email_types.sql |
| AC-033.3.3 | a new booking request is emailed to each Venue Staff member with email on | integration (SQL) | normal | notice_channels_zz_email_types.sql |
| AC-033.3.4 | a booking decision is emailed with its reason and alternative, even with in-app off | integration (SQL) | boundary | notice_channels_zz_email_types.sql |
| AC-033.3.5 | an arrangement review after a planning change is emailed, and stays in-app | integration (SQL) | normal | notice_channels_zz_email_types.sql |
| AC-033.3.6 | a venue-change review follows the choice: with email off it is only in the app | integration (SQL) | boundary | notice_channels_zz_email_types.sql |
| AC-033.3.7 | a notice that is both in-app and emailed appears once in the feed | integration (SQL) | boundary | notice_channels_zz_email_types.sql |

Forced break: sending the booking-request email to nobody fails AC-033.3.3.

## Slice 2d: switched off for everyone, and the flag removed (0106)

| # | Decision | Why |
|---|---|---|
| D13 | `get_my_notification_preferences()` also says, per type, whether an administrator has switched in-app or email off for everyone (the system-wide switches kept as a kill switch, D6). | The person's own choice is kept but cannot override that; the page says so instead of leaving a switch that seems to do nothing. |
| D14 | `VITE_FEATURE_NOTIFICATION_PREFERENCES` is removed; Notification settings is always available. | Every notice now follows the choices, so the switches do what they say. |

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-033.2.9 | when an administrator switches a channel off for everyone, the settings say so for that type only, and the person's own choice is kept | integration (SQL) | conflict | notification_preferences.sql |
| AC-033.2.10 | a type switched off for everyone says which channel; other types say nothing | unit | normal | NotificationPreferencesPage.test.tsx |
| AC-033.2.11 | the note names in-app, or both channels, when those are switched off | unit | boundary | NotificationPreferencesPage.test.tsx |
| AC-033.1.8 | the Notifications page links to the notification settings (no flag) | unit | normal | NotificationsSettingsLink.test.tsx |

Forced break (2d): `get_my_notification_preferences()` made to report nothing as switched off;
AC-033.2.9 failed. Log: `docs/test-evidence/us33/AC-033.2.9-forced-break-0106.log`.

All US33 frontend files are at 100% statements and branches.

