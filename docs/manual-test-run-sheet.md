# Manual test run sheet (Jeremiah's stories)

Every manual check from US5, US19, US21, US26, US32, US33, US43, US44 and US46, in an order that can be
run in one sitting: grouped by the account you are signed in as, and ordered so each check's
set-up comes first. Each row names its story and case; record the result there too (the story's
Manual test cases table has a Result column), as Pass or Fail with the date and who ran it.

## Before you start

- **Supabase** has every migration up to 0123 applied (run `backend/supabase/scripts/check_applied_migrations.py`):
  0123 switches the safety review on, which US26, US43 and US44's checks need.
- **The app** is deployed from main with PR 1 and PR 2 merged. No `VITE_FEATURE_*` variables are needed.
- **Accounts** (README, Test accounts): `organiser@test.com`, `coordinator@test.com`, `venue@test.com`,
  `safety@test.com` and `attendee@test.com`, plus two the README does not list yet: a second Coordinator
  (`coordinator2@test.com`, role `coordinator`) for section 7 and an Operations Manager (`ops@test.com`,
  role `operations_manager`) for section 9. Create them the same way.
- **Test events**, assigned to `coordinator@test.com`:
  - **A**: approved or planning, with a held venue and an essential equipment item, and no programme
    yet (US5 M1, US43 M1 onwards).
  - **B**: planning, with a venue booking still pending (US26 M1, later M2).
  - **C**: confirmed, with a confirmed venue booking, reserved equipment and a registered attendee
    (US21). With the safety review on, confirming goes through it, so prepare C early, or confirm an
    event from section 5 first.
  - **D**: planning, with a registered attendee (US21 M5).

## 1. Organiser (`organiser@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 1 | US32 M1 | Sign in as an Organiser whose event request was approved and open **Notifications**. | The approval appears, naming the event, with the time it was sent. | |

## 2. Coordinator, planning (`coordinator@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 2 | US5 M1 | As a Coordinator, open an event assigned to you that has a held venue and an essential equipment item. | Readiness shows Venue booking and Equipment reservation as Outstanding, with links. | |
| 3 | US43 M1 | Sign in as a Coordinator and open an event in Planning with an approved venue and reserved essential equipment but no programme. | Readiness shows Programme outstanding; "Send for safety review" is not offered. | |
| 4 | US43 M2 | Add the programme; open the event again. | "Send for safety review" appears; pressing it moves the event to "Awaiting safety review". | |
| 5 | US43 M4 | As the Coordinator, open the event. | Only "Cancel event" is offered; Readiness shows "With the Safety Officer for review." | |
| 6 | US26 M1 | As a Coordinator, open an event in Planning whose venue booking is still pending. | No Confirm event button; the Readiness card shows the venue booking as Outstanding and offers no "Send for safety review", so the event cannot move towards confirmation. | |
| 7 | US33 M1 | Sign in as a Coordinator and open Notifications, then Notification settings. | Eight types, every switch on. | |
| 8 | US33 M2 | Turn email off for "Change requests to review", reload. | It stays off; the others are unchanged. | |
| 9 | US32 M2 | Sign in as a Coordinator who was assigned an event and whose venue booking was decided. | Both appear, newest first; the assignment appears once. | |
| 10 | US32 M4 | As the Coordinator from M2, check the nav, then open the venue booking decision. | The nav shows the unread count; opening the decision goes to the event and the count drops by one. | |
| 11 | US32 M5 | Click **Mark all as read**. | Every notice shows as read and the nav count disappears. | |

## 3. Venue Staff (`venue@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 12 | US5 M2 | As Venue Staff, approve the booking; back as the Coordinator, wait up to 30 seconds. | Venue booking turns Complete without reloading. | |
| 13 | US19 M1 | Sign in as Venue Staff. Open **Availability**. | Every active venue is listed for the week starting today, AM/PM/Night for each day. | |
| 14 | US19 M2 | With a confirmed booking and a tentative hold in the shown week, view as Venue Staff and as a Coordinator. | Confirmed cells read "Booked", held cells "Held", their setup/turnaround cells striped. Note whether Venue Staff see the event reference (see Known limitations). | |
| 15 | US19 M3 | Block a venue for one slot (US12), then reload Availability. | That cell reads "Blocked" with the reason. | |
| 16 | US46 M1 | Sign in as Venue Staff and open **Add venue**. Add a venue with two layouts. | "Venue added"; the venue appears on **Availability** and in venue search with its larger layout. | |
| 17 | US46 M2 | Try a capacity of 0, then a name another venue uses. | Each is refused with its reason; nothing is saved. | |
| 18 | US46 M4 | As Venue Staff, open **Manage venues**, edit a venue that has a confirmed booking, and lower its booked layout's capacity below that event's attendance. | "Venue updated" says 1 booking was sent for review; the booking is still confirmed. | |
| 19 | US46 M6 | Open the same venue in two tabs, save in one, then save in the other. | The second save is refused as changed by someone else; "Reload the venue" shows the first save. | |
| 20 | US46 M7 | As Venue Staff, open a venue with a confirmed booking, enter a reason, click **Retire venue…**, then **Confirm retirement**. | "Venue retired"; the venue no longer appears in venue search or availability; the booking is still confirmed. | |
| 21 | US32 M6 | As Venue Staff, open a new booking request from Notifications, then visit Booking requests. | It opens the booking's review page, and shows as read on both pages. | |

## 4. Safety Officer (`safety@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 22 | US43 M3 | Sign in as the Safety Officer and open Notifications. | "Safety review needed: …" is listed. | |
| 23 | US43 M5 | After 0109: as the Safety Officer, open Safety reviews. | The event is listed with its attendance, venues and capacity, accessibility, equipment and restrictions; the oldest sent is first. | |
| 24 | US44 M1 | As the Safety Officer, open Safety reviews, press Review on an event, choose Approve without answering the factors. | The form lists every factor still to answer; nothing is saved. | |
| 25 | US44 M2 | Answer every factor (one concern, with a note), choose Request changes, add a comment, tick Venue, record. | The event leaves the queue with "changes requested"; it is now Safety Changes Requested. | |

## 5. Coordinator again (`coordinator@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 26 | US44 M3 | As its Coordinator, open the event and Notifications. | The Safety review panel shows the decision, comment, "Revisit: venue" and the concern; a "Safety review changes requested" notice is listed. | |
| 27 | US44 M4 | As the Coordinator, try to confirm the event. | Not offered; only cancelling is. | |
| 28 | US46 M5 | Sign in as that event's Coordinator and open the event. | The arrangement review panel shows the capacity reason; resolving it works as for any other review. | |
| 29 | US46 M8 | Sign in as that event's Coordinator and open the event. | The arrangement review panel shows the retirement with its reason. | |
| 30 | US46 M9 | As a Coordinator, open the retired venue's timetable from an old link and try to hold a slot. | The hold is refused. | |
| 31 | US26 M2 | Once Venue Staff approve the booking and the programme is written, send the event for safety review (Readiness card), sign in as the Safety Officer and approve it, then as the Coordinator press Confirm event on the event, now In Preparation. | The event is Confirmed; the Organiser sees "Your event has been confirmed and is ready to proceed." | |
| 32 | US21 M4 | As a Coordinator, open a confirmed event with registered attendees and use Reschedule with a later date. | The event is Planning with the new date; its bookings show "Needs review"; attendees get "Event rescheduled: …" with the new and old times. | |
| 33 | US21 M5 | Postpone a planned event with registered attendees. | Attendees get "Event postponed: …"; its bookings are unchanged. | |
| 34 | US21 M1 | As a Coordinator, cancel a confirmed event that has a confirmed venue booking, reserved equipment and registered attendees. | The confirmation says what will happen; the event is Cancelled. | |
| 35 | US21 M2 | Open the venue's availability for that time. | Free again. | |

## 6. Venue Staff and an Attendee

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 36 | US21 M3 | As Venue Staff, and as a registered attendee, open Notifications. | "Venue booking cancelled: …" and "Event cancelled: …" respectively. | |

## 7. A second Coordinator (`coordinator2@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 37 | US5 M3 | Open the same event as another Coordinator. | No readiness card. | |
| 38 | US26 M3 | As another Coordinator, try to hold the same venue at the same time for a different event. | Refused; the time is taken. | |
| 39 | US32 M3 | Sign in as another Coordinator. | None of the first Coordinator's notices appear. | |

## 8. Attendee (`attendee@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 40 | US33 M3 | Sign in as an Attendee. | Only "Your registrations", "Waiting list updates" and "Cancelled, postponed or rescheduled events". | |

## 9. Operations Manager (`ops@test.com`)

| # | Case | Do | Expect | Result |
|---|---|---|---|---|
| 41 | US46 M3 | Sign in as an Operations Manager and open `/venues/new`. | Told adding venues is for Venue Staff. | |

## Retired

| Case | Why |
|---|---|
| US43 M0 | Retired: the safety review is switched on (0123), so there is no switched-off state to check. |

41 checks to run. When they are done, copy each result into its story's table.
