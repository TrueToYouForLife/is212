# US43 Operational safety review (SCRUM-239): test cases

Week 7 change 6, built in slices.

| Slice | ACs | Status |
|---|---|---|
| 1. Sending an event for its safety review (0108) | AC-043.1, AC-043.2, AC-043.3 | implemented; automated cases pass; **switched off** until the checklist below is met |
| 2. The Safety Officer's review queue (0109) | AC-043.4 | implemented; automated cases pass; menu link shown once switched on |

Test IDs follow `CLAUDE.md`: `AC-043.Y.Z`, Z unique across the story and increasing top to bottom
within each test file. Next free IDs: AC-043.1.20, AC-043.2.8, AC-043.3.8, AC-043.4.17.

## Acceptance criteria

- **AC-043.1 (revised, see below)** The Event Coordinator sends an event for its safety review once
  every arrangement on its readiness card is complete (venue bookings approved, essential equipment
  reserved, equipment requests reviewed by Technical Support, programme written); the system
  refuses until then, and routes the event to the Safety Officer.
- AC-043.2 Sending the event changes its status to Awaiting Safety Review, and Safety Officers are
  notified.
- AC-043.3 While awaiting review, the event cannot move to In Preparation or Confirmed.
- AC-043.4 A Safety Officer can see the events awaiting review, oldest first, with what the review
  needs (slice 2).

Team decision: an event is confirmed only after the Safety Officer approves it.

### Why AC-043.1 was revised (PO decision)

The original wording was "An event for safety review will be sent by the system to the Safety
Officer once all its required venue bookings are approved and every essential equipment requirement
is reserved or marked non-essential." Built literally, the system sent an event the moment it looked
complete. In practice that sent events too early: an event whose venue was approved before any
equipment had been added looked complete (no equipment yet means nothing unreserved), went to the
Safety Officer, and was then locked, since arrangements cannot change during review. It also moved
events out of Planning behind other stories' backs, which broke US48's replacement flow and several
existing tests.

The system cannot tell "needs no equipment" from "equipment not added yet"; only the Coordinator
knows when planning is finished. So the Coordinator sends the event, and the system checks the same
readiness rule as the readiness card (US5) before allowing it. This matches the customer's wording
("after the venue and technical arrangements have been confirmed, the Safety Officer must
conduct an Operational Safety Check") and changes no other story's behaviour.

## Switching the safety review on

0108 ships **switched off** (`safety_review_settings.enabled = false`, and the frontend flag
`VITE_FEATURE_SAFETY_REVIEW` unset). While off, Planning -> Confirmed works exactly as before,
nothing can be sent for review, readiness shows no safety line and no Safety reviews link appears.
Agreed with Justas (US49): migrations are applied in number order (0107, 0108, then 0110), and the
safety review is switched on only when all of these are deployed and checked:

1. US49 slice 3 (0110): Coordinators can cancel a rejected booking, since 0107 keeps a rejected
   booking outstanding and nothing else can clear it.
2. US44: the Safety Officer can decide a review, so events can leave Awaiting Safety Review.
3. US26: an event In Preparation can be confirmed.
4. US45: a sent-back event can be revised and sent again, and a later change sends it back.

Then, together: `update public.safety_review_settings set enabled = true, updated_at = now();` on
Supabase, and `VITE_FEATURE_SAFETY_REVIEW=true` for the frontend. Switching back off is the same
update with `false`.

## The lifecycle

```
approved -> planning -> awaiting_safety_review -> in_preparation -> confirmed -> completed
                               |        ^
                               v        |
                     safety_changes_requested
```

Any status before completed can be cancelled; submitted and under_review can still be withdrawn
(US22). Planning -> Confirmed is no longer possible.

| Step | Who | Story |
|---|---|---|
| Planning -> Awaiting Safety Review | the Coordinator, with "Send for safety review", once readiness is complete | US43 |
| Awaiting -> In Preparation / Safety Changes Requested | Safety Officer | US44 |
| Safety Changes Requested -> Planning -> Awaiting | Coordinator revises ("Revise arrangements"), then sends it for review again | US45 |
| In Preparation -> Confirmed | Coordinator | US26 |

## Design decisions (slice 1)

| # | Decision | Why |
|---|---|---|
| D1 | New role `safety_officer`; statuses `awaiting_safety_review`, `safety_changes_requested`, `in_preparation`; US22's `withdrawn` kept. | Week 7 change 6; status rules every story relies on, rebuilt from the latest versions (0066, 0006, 0038, 0041). |
| D2 | One readiness rule: 0076's readiness lines move into `event_readiness_lines()`, used by the readiness card (`get_event_readiness()`, still the assigned Coordinator only) and by `event_ready_for_safety_review()`. Ready means every line is complete except registration setup (it only opens on confirmation) and the safety review itself. | The card and the review can never disagree about what "ready" means. |
| D3 | `send_for_safety_review()`: only the event's assigned Coordinator, only from Planning, only when ready; records who sent it and when (`safety_review_requested_by`, `safety_review_requested_at`). | AC-043.1 as revised; US44 and US45 build on the record. |
| D4 | The status trigger also refuses Planning -> Awaiting Safety Review unless the actor is a Coordinator and the event is ready (SQLSTATE 55000 when not ready). | A direct status change cannot skip the check. |
| D5 | Only a Safety Officer moves an event out of Awaiting Safety Review (except cancelling). | AC-043.3; US44 builds the decision. |
| D6 | Each Safety Officer is notified through the US33 helper under a new type, "Events awaiting safety review", so they choose in-app and/or email like everyone else. | AC-043.2, consistent with US33. |
| D7 | The readiness card gains a "Safety review" line (waiting to be sent, with the Safety Officer, changes requested, approved), and in Planning a "Send for safety review" button that only appears once everything else is complete. | The card the Coordinator already uses shows the whole path to confirmation. |
| D8 | Events in the safety stages count as active in the Lead's workload (0041). | Week 7 change 5. |
| D9 | No event leaves Planning by itself, so no other story's behaviour or tests change. | The automatic version broke US48 and others. |
| D10 | A switch, off by default: `safety_review_settings` and `safety_review_enabled()` in the database (Planning -> Confirmed while off; review first while on), matched by `VITE_FEATURE_SAFETY_REVIEW` in the app. `is_valid_status_transition()` becomes `stable` since it reads the switch; only the status trigger uses it. A replay never switches it back off. | 0108 can be merged and applied now without blocking confirmations, before US49's cancellation (0110), US44 and US26 exist. |
| D11 | The shared readiness rule is 0107's (US49): every live booking approved, at least one approved, a rejected booking outstanding, cancelled and expired ones not counted. `event_readiness_lines()` carries 0107's lines exactly; `get_event_readiness()` wraps it. 0107 replaces readiness with its own full version, so `run_venue_time_conversion.sh` applies 0108 again straight after 0107. | Agreed with Justas: the card and the send check must use the same rule. Later readiness changes go in `event_readiness_lines()`. |

Open question for US45/US48 (Jaydon): if a venue becomes unavailable while an event is in safety
review or in preparation, replacement and a return to review belong to US45.

## Automated test cases (slice 1)

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-043.1.1 | not sent while a venue awaits Venue Staff, an essential item is unavailable, the programme is missing or Technical Support has not reviewed a request | integration (SQL) | boundary | safety_review.sql |
| AC-043.1.2 | only the assigned Coordinator can send it; another Coordinator, the Organiser, a Safety Officer or a Lead is refused | integration (SQL) | conflict | safety_review.sql |
| AC-043.1.3 | once ready, the Coordinator sends it, and who sent it and when is recorded | integration (SQL) | normal | safety_review.sql |
| AC-043.1.4 | registration setup does not hold the review back | integration (SQL) | boundary | safety_review.sql |
| AC-043.1.5 | only an event in Planning can be sent; Approved or already sent is refused | integration (SQL) | failure | safety_review.sql |
| AC-043.1.6 | an event never leaves Planning by itself, even once ready | integration (SQL) | boundary | safety_review.sql |
| AC-043.1.7 | a direct status change cannot skip the check | integration (SQL) | conflict | safety_review.sql |
| AC-043.1.8 | with several venues the card and the send check agree: approved and rejected, or approved and held, is not ready; all approved is | integration (SQL) | boundary | safety_review.sql |
| AC-043.2.1 | each Safety Officer is told once, naming the event and its attendance, through their chosen channels | integration (SQL) | normal | safety_review.sql |
| AC-043.2.2 | the notice appears once for each Safety Officer and nobody else; they can choose its channels | integration (SQL) | normal | safety_review.sql |
| AC-043.2.3 | Safety Officer is a role an account can hold; an unknown role is refused | integration (SQL) | failure | safety_review.sql |
| AC-043.2.4 | readiness shows the safety review: waiting to be sent, then with the Safety Officer | integration (SQL) | normal | safety_review.sql |
| AC-043.3.1 | a Coordinator cannot move an awaiting event to In Preparation or Confirmed | integration (SQL) | conflict | safety_review.sql |
| AC-043.3.2 | an event in Planning can no longer be confirmed | integration (SQL) | conflict | safety_review.sql |
| AC-043.3.3 | only a Safety Officer's decision moves it on; its Coordinator can still cancel | integration (SQL) | normal | safety_review.sql |
| AC-043.3.4 | safety stages still count as active for the Lead | integration (SQL) | boundary | safety_review.sql |
| AC-043.3.5 | a submitted or under-review request can still be withdrawn (US22) | integration (SQL) | boundary | safety_review.sql |
| AC-043.1.17 | while switched off, Planning is confirmed as before, nothing can be sent and readiness shows no safety line | integration (SQL) | normal | safety_review.sql |
| AC-043.1.18 | after 0107, readiness is still the shared rule: approved and rejected is outstanding on the card and not ready for review | integration (SQL) | conflict | safety_review_readiness.sql |
| AC-043.1.9 | the rules mirror 0108: Planning leads only to review; Confirmed only follows In Preparation | unit | normal | safetyReviewStatuses.test.tsx |
| AC-043.1.10 | no status button sends an event for review; that is done from the readiness card | unit | conflict | safetyReviewStatuses.test.tsx |
| AC-043.2.5 | every safety stage has a label and a badge | unit | normal | safetyReviewStatuses.test.tsx |
| AC-043.2.6 | the Organiser is told their event is with the Safety Officer and not yet confirmed | unit | normal | safetyReviewStatuses.test.tsx |
| AC-043.2.7 | Safety Officer is a role the app recognises and names | unit | normal | safetyReviewStatuses.test.tsx |
| AC-043.3.6 | a Coordinator awaiting review can only cancel; deciding is the Safety Officer's | unit | conflict | safetyReviewStatuses.test.tsx |
| AC-043.1.15 | in Planning the hint points to the readiness card and there is no Confirm; In Preparation offers Confirm | unit | normal | safetyReviewStatuses.test.tsx |
| AC-043.1.11 | ready means every readiness line complete, except registration setup and the safety review | unit | boundary | safetyReviewSend.test.tsx |
| AC-043.1.12 | in Planning and ready, "Send for safety review" sends it and the page refreshes | unit | normal | safetyReviewSend.test.tsx |
| AC-043.1.13 | until ready the card says so instead; outside Planning it offers nothing | unit | boundary | safetyReviewSend.test.tsx |
| AC-043.1.14 | a refused send says why, the page is not refreshed, and the button works again | unit | failure | safetyReviewSend.test.tsx |
| AC-043.1.16 | sending calls the database once for the event, and each refusal says why (including "not switched on yet") | unit (service) | failure | safetyReviewService.test.ts |
| AC-043.1.19 | while switched off, Planning still offers Confirm with today's hint and the readiness card offers no safety review | unit | normal | safetyReviewSwitchedOff.test.tsx |

US43's own tests switch the safety review on (database: inside their rolled-back transaction;
frontend: by mocking the flag). Existing tests run with it off, so they keep testing today's
behaviour: only the role vocabulary test and the lifecycle table (new rows for the three statuses)
changed. US5's AC-005.2.1 now expects 0107's rule (a rejection stays outstanding), same ID.

## Slice 2: the Safety Officer's review queue (0109)

| # | Decision | Why |
|---|---|---|
| D12 | `get_safety_review_queue()`: Safety Officers only; events in Awaiting Safety Review, ordered by when the Coordinator sent them (`safety_review_requested_at`, slice 1), oldest first. Read-only. | AC-043.4. The decision itself is US44. |
| D13 | For each event: expected attendance; accessibility requirements by name; each approved venue booking with its layout and attendance (the booking's own, US49, else the event's) against the venue's capacity for that layout, the venue's accessibility, and its restrictions; each equipment request with quantity, essential or not, status and how many items are actually reserved. Over-capacity spaces are flagged on the page. | AC-043.4's list, from data the system already holds. |
| D14 | "Known venue restrictions" are the ones the system records: retired (with the note) or under maintenance, opening hours unless open all day, and any active venue block (US12, slot or continuous) on the event's dates. | No separate restrictions field exists; these are the ones a Safety Officer must know. |
| D15 | 0109 reads continuous venue blocks, so like 0102 and 0103 it is skipped in both runners' first pass and applied and tested in `run_venue_time_conversion.sh` after 0100, in both CI modes. | It depends on 0100. |
| D16 | A "Safety reviews" page at `/safety-reviews`, in the Safety Officer's menu once the safety review is switched on (`VITE_FEATURE_SAFETY_REVIEW`). | Where the Safety Officer starts; hidden while there is nothing to review. |

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-043.4.1 | the queue lists only events awaiting review, the one sent first at the top | integration (SQL) | normal | safety_review_queue.sql |
| AC-043.4.2 | each event shows its expected attendance, its accessibility requirements by name, and when it was sent | integration (SQL) | normal | safety_review_queue.sql |
| AC-043.4.3 | each approved venue shows its booking's layout and attendance against the venue's capacity for that layout, and its accessibility | integration (SQL) | normal | safety_review_queue.sql |
| AC-043.4.4 | each venue lists its known restrictions: maintenance, opening hours, and blocks on the event's dates only | integration (SQL) | boundary | safety_review_queue.sql |
| AC-043.4.5 | the equipment shows each request, essential first, with how many items are actually reserved | integration (SQL) | normal | safety_review_queue.sql |
| AC-043.4.6 | only a Safety Officer can see the queue | integration (SQL) | conflict | safety_review_queue.sql |
| AC-043.4.7 | once the Safety Officer has decided an event, it leaves the queue | integration (SQL) | boundary | safety_review_queue.sql |
| AC-043.4.8 | the queue is read once, kept in the database's order, and named for the app | unit (service) | normal | safetyReviewQueueService.test.ts |
| AC-043.4.9 | a non-Safety Officer is told it is not theirs; any other failure or unexpected answer says to try again | unit (service) | failure | safetyReviewQueueService.test.ts |
| AC-043.4.10 | events listed oldest first, with when sent, attendance and accessibility needs | unit | normal | SafetyReviewQueuePage.test.tsx |
| AC-043.4.11 | each venue shows layout, attendance against capacity (flagging over capacity), accessibility and restrictions | unit | boundary | SafetyReviewQueuePage.test.tsx |
| AC-043.4.12 | the equipment shows each request, whether essential, and how many items are reserved | unit | normal | SafetyReviewQueuePage.test.tsx |
| AC-043.4.13 | with nothing waiting it says so; a failed load shows why; an event without a reference uses its name | unit | failure | SafetyReviewQueuePage.test.tsx |
| AC-043.4.14 | an answer arriving after the Safety Officer left the page is ignored | unit | boundary | SafetyReviewQueuePage.test.tsx |
| AC-043.4.15 | a Safety Officer is offered Safety reviews in the menu; a Coordinator is not | unit | normal | SafetyReviewQueuePage.test.tsx |
| AC-043.4.16 | while switched off, a Safety Officer is not offered Safety reviews | unit | normal | SafetyReviewNavSwitchedOff.test.tsx |

Forced break (slice 2): `get_safety_review_queue()` made to list the newest first; AC-043.4.1
failed. Log: `docs/test-evidence/us43/AC-043.4.1-forced-break.log`. `SafetyReviewQueuePage.tsx` and
`safetyReviewQueueService.ts` are at 100% statements and branches.

## Manual test cases (shared Supabase, after 0108 is applied)

| ID | Steps | Expected |
|---|---|---|
| M0 | With the switch off, open an event in Planning as its Coordinator. | Confirm is offered as before; no Safety review line or button. |
| M1 | Switch the safety review on (checklist above). Give a test account the role `safety_officer`. As a Coordinator, open an event in Planning with an approved venue and reserved essential equipment but no programme. | Readiness shows Programme outstanding; "Send for safety review" is not offered. |
| M2 | Add the programme; open the event again. | "Send for safety review" appears; pressing it moves the event to "Awaiting safety review". |
| M3 | Sign in as the Safety Officer and open Notifications. | "Safety review needed: …" is listed. |
| M4 | As the Coordinator, open the event. | Only "Cancel event" is offered; Readiness shows "With the Safety Officer for review." |
| M5 | After 0109: as the Safety Officer, open Safety reviews. | The event is listed with its attendance, venues and capacity, accessibility, equipment and restrictions; the oldest sent is first. |

## Coverage and forced break

`EventReadinessCard.tsx`, `readinessService.ts`, `safetyReviewReadiness.ts`, `statusRules.ts`,
`StatusBadge.tsx`, `RequestStatusPanel.tsx` and `auth/types.ts` are at 100%. Every line US43 adds to
`ReviewActions.tsx` and `CoordinatorAssignmentQueue.tsx` is covered; each keeps one branch that was
uncovered before this change. SQL has no coverage tool; 0108 is covered case by case above.

Both flag states are covered: `statusRules.ts`, `ReviewActions.tsx` and `EventReadinessCard.tsx` are
tested with the flag on and off.

Forced break: in `0108_us43_safety_review.sql`, `event_ready_for_safety_review()` was made to ignore
the programme (`'programme'` added to the lines it skips). AC-043.1.1 failed; the file was then
restored. Log: `docs/test-evidence/us43/AC-043.1.1-forced-break.log`.
