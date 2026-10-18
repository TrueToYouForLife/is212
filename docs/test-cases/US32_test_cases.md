# US32 View in-app notifications (SCRUM-229): test cases

Built code-first in slices (trunk-based development): each slice is its own branch and PR,
merged when CI is green, with the page behind `VITE_FEATURE_NOTIFICATIONS` until the last slice.

| Slice | ACs | Status |
|---|---|---|
| 1. The feed and the Notifications page | AC-032.1, AC-032.5 | implemented; automated cases pass |
| 2. Read and unread, the nav count, opening a notification, mark all read | AC-032.2, AC-032.3, AC-032.4 | not started |

Test IDs follow `CLAUDE.md`: `AC-032.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-032.1.21, AC-032.2.1, AC-032.3.1, AC-032.4.1,
AC-032.5.9.

## Acceptance criteria (Jira)

- AC-032.1 A user can see a list of their notifications, newest first, each showing what
  happened, which event it concerns, and when.
- AC-032.2 Unread notifications are visibly distinguished, with an unread count shown in the
  navigation.
- AC-032.3 Opening a notification marks it as read and takes the user to the related event or item.
- AC-032.4 A user can mark all notifications as read.
- AC-032.5 A user only ever sees their own notifications.

## Requirements behind the design

- Week 4 core feature "Notification System": users receive notifications about event
  submission, clarification requests, approval or rejection, coordinator assignment, venue
  booking decisions, important event changes, registration updates, confirmation or cancellation.
- Week 7 changes #2, #4 and #5 add notices for affected bookings, expiring holds and
  (re)assignments.
- The backlog chose both channels: US4 sends email, US32 shows notifications in the app, and
  US33 lets users choose the channel per type.

## Design decisions (slice 1)

| # | Decision | Why |
|---|---|---|
| D1 | The feed reads every existing notification source and changes none of them: arrangement reviews (US41/US20/US46), change requests (US7), coordinator assignments (US17), equipment requirements and reservation outcomes (US13/US14), venue booking decisions (US10), new venue booking requests (US9), and the email outbox. | Each feature keeps its own design; no teammate's code changes inside US32. |
| D2 | Email-only notifications (event decisions, registrations, withdrawals, waiting-list offers, venue block alerts, equipment reservations) appear in-app by reading the outbox rows addressed to the signed-in user's own email, compared without regard to letter case. | About half the notification types exist only as emails, and those are most of what Organisers and Attendees receive. The team's emails go to placeholder addresses, so the in-app feed is where these notices can actually be seen. |
| D3 | An email that a feature also recorded in-app (its `email_outbox_id`) is shown once, as the in-app record. | No duplicates, and the in-app record already respects the user's in-app setting. |
| D4 | The in-app sources are read with the user's own permissions (`SECURITY INVOKER`), so each table's existing read rule decides what appears, including the in-app on/off settings of US7 and US17. Only the outbox, which the app cannot read, is read by a function that returns the user's own rows. | The feed can never show more than the feature itself allows. |
| D5 | Event names come from `events` under the same rules. Venue Staff cannot read events, so their booking-request notices name the venue instead. | No new access to events. |
| D6 | Times are shown in Singapore time: "Today, 3:04 pm", "Yesterday, 9:00 am", or the date. | Matches the rest of the app; the day changes at midnight Singapore time. |
| D7 | Each notification is identified by its source and id. | Slice 2's read state is keyed on that pair, with no change to the sources. |

Known gap, outside US32: four notification types are in-app only and send no email (arrangement
reviews, new venue booking requests, venue booking decisions, equipment requirement changes).
Sending those by email belongs with US33 (choosing channels per type) or a ticket of its own.

## Automated test cases (slice 1)

Types: **integration (SQL)** runs against PostgreSQL with real RLS; **unit** is a pure module
or component; **unit (service)** is a service against the mocked Supabase client.

### AC-032.1 A user sees their notifications, newest first, with what happened, which event and when

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.1.1 | a Coordinator sees every kind of notice addressed to them, newest first, each naming its event | integration (SQL) | normal | notification_feed.sql |
| AC-032.1.2 | each notice says what happened in words: a decision with reason and alternative, a partial reservation, a review | integration (SQL) | normal | notification_feed.sql |
| AC-032.1.3 | an Organiser sees decisions that were only emailed to them, in the app, with their event | integration (SQL) | normal | notification_feed.sql |
| AC-032.1.4 | an Attendee sees emailed notices even when the address differs in letter case | integration (SQL) | boundary | notification_feed.sql |
| AC-032.1.5 | Venue Staff see a new booking request, named by its venue | integration (SQL) | normal | notification_feed.sql |
| AC-032.1.6 | Technical Support see equipment requirement changes | integration (SQL) | normal | notification_feed.sql |
| AC-032.1.7 | asking for a few notifications returns the newest ones | integration (SQL) | boundary | notification_feed.sql |
| AC-032.1.8 | today and yesterday are named; older notices show their date, in Singapore time | unit | normal | notificationFormat.test.ts |
| AC-032.1.9 | the day changes at midnight in Singapore, not UTC | unit | boundary | notificationFormat.test.ts |
| AC-032.1.10 | the event is named by reference and name, or whichever the user can see | unit | boundary | notificationFormat.test.ts |
| AC-032.1.11 | the feed is read in one call and each row becomes a notification, in order | unit (service) | normal | notificationService.test.ts |
| AC-032.1.12 | with nothing sent yet the list is empty; 100 are asked for by default | unit (service) | boundary | notificationService.test.ts |
| AC-032.1.13 | a failed or unexpected answer is reported and logged, never an empty list | unit (service) | failure | notificationService.test.ts |
| AC-032.1.14 | each notification shows what happened, its event and when, in the feed's order | unit | normal | NotificationsPage.test.tsx |
| AC-032.1.15 | a notice with no visible event or detail shows just what happened and when | unit | boundary | NotificationsPage.test.tsx |
| AC-032.1.16 | with no notifications the page says so | unit | boundary | NotificationsPage.test.tsx |
| AC-032.1.17 | a failed load shows the error, not an empty list | unit | failure | NotificationsPage.test.tsx |
| AC-032.1.18 | leaving before the notifications arrive does not update the page | unit | boundary | NotificationsPage.test.tsx |
| AC-032.1.19 | every signed-in role is offered Notifications once the feature is on | unit | normal | TopNav.test.tsx |
| AC-032.1.20 | Notifications is not offered while the feature is off, or to someone signed out | unit | conflict | TopNav.test.tsx |

### AC-032.5 A user only ever sees their own notifications

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.5.1 | another Coordinator sees none of the first Coordinator's notices | integration (SQL) | conflict | notification_feed.sql |
| AC-032.5.2 | a notice switched off in-app is not shown | integration (SQL) | boundary | notification_feed.sql |
| AC-032.5.3 | an email a feature also recorded in-app appears once, not twice | integration (SQL) | conflict | notification_feed.sql |
| AC-032.5.4 | emails to other addresses are never shown; a signed-out request is refused | integration (SQL) | failure | notification_feed.sql |
| AC-032.5.5 | the email outbox itself stays unreadable from the app | integration (SQL) | conflict | notification_feed.sql |
| AC-032.5.6 | a signed-out request is refused and the user asked to sign in | unit (service) | failure | notificationService.test.ts |
| AC-032.5.7 | someone signed out is asked to sign in, and nothing is loaded | unit | conflict | NotificationsPage.test.tsx |
| AC-032.5.8 | while the session loads, nothing is shown or loaded | unit | boundary | NotificationsPage.test.tsx |

## Manual test cases (shared Supabase, after 0072 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | With `VITE_FEATURE_NOTIFICATIONS=true`, sign in as an Organiser whose event request was approved and open **Notifications**. | The approval appears, naming the event, with the time it was sent. |
| M2 | Sign in as a Coordinator who was assigned an event and whose venue booking was decided. | Both appear, newest first; the assignment appears once. |
| M3 | Sign in as another Coordinator. | None of the first Coordinator's notices appear. |

## Coverage and forced break

`notificationFormat.ts`, `notificationService.ts` and `NotificationsPage.tsx` are at 100%
statements, branches, functions and lines (`types.ts` holds types only). SQL has no coverage
tool; 0072 is covered case by case above.

Forced break: in `0072_notification_feed.sql`, the email match
`lower(o.recipient_email) = lower(u.email)` was changed to `o.recipient_email = u.email`.
AC-032.1.4 failed; the file was then restored. Log: `docs/test-evidence/us32/AC-032.1.4-forced-break.log`.
