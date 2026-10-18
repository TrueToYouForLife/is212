# US32 View in-app notifications (SCRUM-229): test cases

Built code-first in slices (trunk-based development): each slice is its own branch and PR,
merged when CI is green, with the page behind `VITE_FEATURE_NOTIFICATIONS` until the last slice,
which removed the flag.

| Slice | ACs | Status |
|---|---|---|
| 1. The feed and the Notifications page | AC-032.1, AC-032.5 | merged (0072) |
| 2. Read and unread, the nav count, opening a notification, mark all read | AC-032.2, AC-032.3, AC-032.4 (and AC-032.5 for read state) | implemented; automated cases pass |

Test IDs follow `CLAUDE.md`: `AC-032.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-032.1.21, AC-032.2.12, AC-032.3.14, AC-032.4.7,
AC-032.5.11.

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

## Design decisions (slice 2)

| # | Decision | Why |
|---|---|---|
| D8 | Read state lives in one new table, `notification_reads`, keyed on the feed's (source, id). No source table changes. | Every kind of notice gets the same read and unread behaviour without touching the features that send them. |
| D9 | Only a notice in the user's own feed can be marked read (`mark_notification_read` checks the feed first); a user can only ever read or write their own read state. | AC-032.5 applies to read state too. |
| D10 | US9's booking-request notices already had their own `read_at`. Either one counts as read, and reading one in either place marks it read in both. | Venue Staff see the same answer on both pages. |
| D11 | Opening a notice takes each role to a page it already has: Organisers, Coordinators, Leads and Operations Managers to the event's request page; Venue Staff to the booking a request is about (or the queue); Technical Support to Equipment; Attendees to My registrations. A notice with nowhere better to go is marked read in place. | AC-032.3, with no new pages. |
| D12 | If a notice cannot be marked read, the user is told, and is still taken to it. | Failing to record a read must not stop the user getting to their event. |
| D13 | The nav shows the unread count beside Notifications, re-read on every page change and after any notice is marked read; over 99 shows "99+". If the count cannot be read, no number is shown. | A wrong count is worse than none. |
| D14 | `VITE_FEATURE_NOTIFICATIONS` is removed: Notifications is in every signed-in role's nav. | US32 is complete. |

Venue notices now also carry the booking they are about (`item_id`), and every notice carries
`read_at`; 0073 recreates `get_my_notifications()` with those two columns.

## Automated test cases (slice 2)

### AC-032.2 Unread notifications are visibly distinguished, with an unread count in the navigation

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.2.1 | every notification starts unread, and the count is how many there are | integration (SQL) | normal | notification_feed.sql |
| AC-032.2.2 | a venue notification carries the booking it is about | integration (SQL) | normal | notification_feed.sql |
| AC-032.2.3 | the unread count is read in one call; an answer without a number counts as none | unit (service) | boundary | notificationService.test.ts |
| AC-032.2.4 | a count that cannot be read is reported and logged; signed out asks to sign in | unit (service) | failure | notificationService.test.ts |
| AC-032.2.5 | unread notices are marked unread on screen and for screen readers; read ones are not | unit | normal | NotificationsPage.test.tsx |
| AC-032.2.6 | the count is read when the nav appears | unit | normal | useUnreadNotificationCount.test.tsx |
| AC-032.2.7 | the count is re-read on every page change and whenever notices are marked read | unit | normal | useUnreadNotificationCount.test.tsx |
| AC-032.2.8 | a count that cannot be read shows no number rather than a wrong one | unit | failure | useUnreadNotificationCount.test.tsx |
| AC-032.2.9 | signed out nothing is read; an answer after leaving is ignored | unit | boundary | useUnreadNotificationCount.test.tsx |
| AC-032.2.10 | the count is shown beside Notifications and read out with it | unit | normal | TopNav.test.tsx |
| AC-032.2.11 | no number at zero or when unknown; over 99 shows 99+ | unit | boundary | TopNav.test.tsx |

### AC-032.3 Opening a notification marks it read and goes to its event or item

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.3.1 | opening a notification marks that one read and lowers the count by one | integration (SQL) | normal | notification_feed.sql |
| AC-032.3.2 | opening an already-read notification again changes nothing | integration (SQL) | boundary | notification_feed.sql |
| AC-032.3.3 | nobody can mark a notification that is not in their own feed | integration (SQL) | conflict | notification_feed.sql |
| AC-032.3.4 | a booking request read on US9's page shows as read; reading one here marks it there too | integration (SQL) | normal | notification_feed.sql |
| AC-032.3.5 | marking one read names it by source and id and refreshes the nav count | unit (service) | normal | notificationService.test.ts |
| AC-032.3.6 | a notice that cannot be marked is reported and logged; the count is not refreshed | unit (service) | failure | notificationService.test.ts |
| AC-032.3.7 | Organisers, Coordinators, Leads and Operations Managers go to the event's request page | unit | normal | notificationFormat.test.ts |
| AC-032.3.8 | Venue Staff go to the booking a request is about, or the queue | unit | normal | notificationFormat.test.ts |
| AC-032.3.9 | Technical Support go to Equipment, Attendees to My registrations; signed out goes nowhere | unit | boundary | notificationFormat.test.ts |
| AC-032.3.10 | opening an unread notice marks it read, then goes to its event | unit | normal | NotificationsPage.test.tsx |
| AC-032.3.11 | opening a read notice goes straight there without marking it again | unit | boundary | NotificationsPage.test.tsx |
| AC-032.3.12 | a notice with nowhere to go is marked read where it is | unit | boundary | NotificationsPage.test.tsx |
| AC-032.3.13 | if a notice cannot be marked read, the user is told and still taken to it | unit | failure | NotificationsPage.test.tsx |

### AC-032.4 A user can mark all notifications as read

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.4.1 | marking all read clears the user's own unread notices only, and says how many | integration (SQL) | normal | notification_feed.sql |
| AC-032.4.2 | marking all read reports how many there were and refreshes the count | unit (service) | normal | notificationService.test.ts |
| AC-032.4.3 | a failed mark-all is reported and logged; signed out asks to sign in | unit (service) | failure | notificationService.test.ts |
| AC-032.4.4 | marking all read shows every notice as read and disables the button | unit | normal | NotificationsPage.test.tsx |
| AC-032.4.5 | with nothing unread the button cannot be used; while marking it says so | unit | boundary | NotificationsPage.test.tsx |
| AC-032.4.6 | a failed mark-all is reported and nothing is shown as read | unit | failure | NotificationsPage.test.tsx |

### AC-032.5 Each user's read state is their own

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-032.5.9 | another user can neither see someone's read state nor mark their notices read | integration (SQL) | conflict | notification_feed.sql |
| AC-032.5.10 | signed out, nothing can be marked or counted | integration (SQL) | failure | notification_feed.sql |

Slice 1 tests updated for slice 2, IDs unchanged: AC-032.1.11 now also maps `item_id` and
`read_at`; AC-032.1.14 to AC-032.1.18 render inside a router, since notices now navigate;
AC-032.1.16 also checks there is nothing to mark; AC-032.1.19 and AC-032.1.20 test the nav item
without the feature flag.

## Manual test cases (shared Supabase, after 0072 and 0073 are applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | Sign in as an Organiser whose event request was approved and open **Notifications**. | The approval appears, naming the event, with the time it was sent. |
| M2 | Sign in as a Coordinator who was assigned an event and whose venue booking was decided. | Both appear, newest first; the assignment appears once. |
| M3 | Sign in as another Coordinator. | None of the first Coordinator's notices appear. |
| M4 | As the Coordinator from M2, check the nav, then open the venue booking decision. | The nav shows the unread count; opening the decision goes to the event and the count drops by one. |
| M5 | Click **Mark all as read**. | Every notice shows as read and the nav count disappears. |
| M6 | As Venue Staff, open a new booking request from Notifications, then visit Booking requests. | It opens the booking's review page, and shows as read on both pages. |

## Coverage and forced break

`notificationFormat.ts`, `notificationService.ts`, `useUnreadNotificationCount.ts` and
`NotificationsPage.tsx` are at 100% statements, branches, functions and lines (`types.ts` holds
types only). SQL has no coverage
tool; 0072 and 0073 are covered case by case above.

Forced break (the story's one, in slice 1): in `0072_notification_feed.sql`, the email match
`lower(o.recipient_email) = lower(u.email)` was changed to `o.recipient_email = u.email`.
AC-032.1.4 failed; the file was then restored. Log: `docs/test-evidence/us32/AC-032.1.4-forced-break.log`.
