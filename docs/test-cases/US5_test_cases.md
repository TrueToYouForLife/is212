# US5 Tracking Event Readiness (SCRUM-10): test cases

One slice: a 2-point, read-only view (one database function, one card) with no partial state
worth merging on its own, so splitting it would only spread the same files across PRs.

Test IDs follow `CLAUDE.md`: `AC-005.Y.Z`, Z unique across the story and increasing top to
bottom within each test file. Next free IDs: AC-005.1.6, AC-005.2.6, AC-005.3.3, AC-005.4.3,
AC-005.5.4, AC-005.6.3, AC-005.7.5, AC-005.8.3.

## Acceptance criteria (Jira)

- AC-005.1 The Event Coordinator can view a readiness summary for an event showing the status of
  each required arrangement.
- AC-005.2 The Event Coordinator can see the status of venue booking, equipment reservation,
  technical support assignment, programme, and registration setup.
- AC-005.3 The Event Coordinator can distinguish complete from outstanding arrangements via a
  clear and distinct indicator.
- AC-005.4 The Event Coordinator can only view readiness for events assigned to them.
- AC-005.5 The Event Coordinator can navigate from an outstanding arrangement to the place where
  it is being governed.
- AC-005.6 The readiness view reflects the state of each underlying arrangement automatically.
- AC-005.7 The readiness view updates any change of status to any underlying arrangements.
- AC-005.8 The readiness view excludes all unrelated arrangements instead of showing them as an
  outstanding arrangement.

## Design decisions

| # | Arrangement | Complete when | Shown when (AC-005.8) | Links to (AC-005.5) |
|---|---|---|---|---|
| D1 | Venue booking | every live booking (held, awaiting Venue Staff, confirmed) is confirmed, and there is at least one; expired, rejected and cancelled ones no longer count | always | Venue search, where holds are made |
| D2 | Equipment reservation | every essential equipment requirement is reserved; non-essential ones do not hold it back | the event has equipment requirements | the event's equipment page |
| D3 | Technical support | Technical Support has reviewed every equipment request (none pending review). Nobody is assigned to an event as its Technical Support; reviewing the requests is what the app records (US13). | the event has equipment requirements | the event's equipment page |
| D4 | Programme | the event's programme text is written | always | the event's Planning details section (US20) |
| D5 | Registration setup | Attendees can register: registration is on and the event is Confirmed (US15, US52) | registration is on | the event's Decision section, since registration opens on confirmation |

| # | Decision | Why |
|---|---|---|
| D6 | One database function, `get_event_readiness` (0076), reads every arrangement live and returns one line per arrangement that applies. Only the event's assigned Coordinator may call it. | AC-005.4 is enforced in one place; AC-005.6 holds because nothing is stored that could drift. |
| D7 | The card is re-read every 30 seconds, like the status panel beside it, and at once when the page refreshes after a change made there. | AC-005.7, including changes made by Venue Staff or Technical Support elsewhere. |
| D8 | Each status is shown by a word, a symbol and a colour together (Complete ✓ / Outstanding !). | AC-005.3, without relying on colour. |
| D9 | The page shows whatever lines the database returns; links are looked up by arrangement, and an unknown arrangement gets no link rather than a wrong one. | A later arrangement (the safety review, US43/US44, Sprint 4) is added as one more line in the database function and one link, with no other change. AC-005.6.2 proves this with a test double: a "Safety review" line no story has built yet. |
| D10 | No stand-in data in the running app: every line comes from real records. | A placeholder status would tell Coordinators something nothing tracks. The safety review appears only once US43/US44 add it. |

Shared file changed: `ReviewRequestDetailPage.tsx` shows the card for the assigned Coordinator
and gains two section anchors (`#event-decision`, `#planning-details`) for its links.

## Automated test cases

| ID | Test | Type | Scenario | File |
|---|---|---|---|---|
| AC-005.1.1 | the assigned Coordinator sees one line per arrangement the event needs, in a fixed order | integration (SQL) | normal | event_readiness.sql |
| AC-005.2.1 | venue booking is complete only when every live booking is approved; expired holds and rejections do not count | integration (SQL) | boundary | event_readiness.sql |
| AC-005.2.2 | equipment is complete when every essential item is reserved; non-essential items do not hold it back | integration (SQL) | normal | event_readiness.sql |
| AC-005.2.3 | technical support is complete once Technical Support has reviewed every request | integration (SQL) | normal | event_readiness.sql |
| AC-005.2.4 | the programme is complete once written; a blank one is outstanding | integration (SQL) | boundary | event_readiness.sql |
| AC-005.2.5 | registration setup is complete once Attendees can register | integration (SQL) | normal | event_readiness.sql |
| AC-005.4.1 | another Coordinator, the Organiser, a Lead or someone signed out is refused; an unknown event is not found | integration (SQL) | conflict | event_readiness.sql |
| AC-005.6.1 | each line follows its arrangement as it changes | integration (SQL) | normal | event_readiness.sql |
| AC-005.7.1 | a change in either direction shows at once | integration (SQL) | boundary | event_readiness.sql |
| AC-005.8.1 | an event with no equipment or no registration does not show them as outstanding | integration (SQL) | boundary | event_readiness.sql |
| AC-005.1.2 | the readiness is read in one call and comes back in order | unit (service) | normal | readinessService.test.ts |
| AC-005.1.3 | an empty answer is an empty summary; a failed or unexpected one is reported and logged | unit (service) | failure | readinessService.test.ts |
| AC-005.4.2 | anyone else is told it is for the assigned Coordinator; an unknown event is not found | unit (service) | conflict | readinessService.test.ts |
| AC-005.5.1 | each arrangement links to the page or section that governs it | unit | normal | readinessLinks.test.ts |
| AC-005.5.2 | an arrangement a later story adds has no link until that story gives it one | unit | boundary | readinessLinks.test.ts |
| AC-005.1.4 | every arrangement is listed with status and detail; the summary counts what is complete | unit | normal | ReadinessSummary.test.tsx |
| AC-005.3.1 | complete and outstanding each have their own word and symbol, not just a colour | unit | normal | ReadinessSummary.test.tsx |
| AC-005.3.2 | with everything complete, the summary says so | unit | boundary | ReadinessSummary.test.tsx |
| AC-005.5.3 | outstanding lines link onwards; complete lines do not | unit | normal | ReadinessSummary.test.tsx |
| AC-005.6.2 | an arrangement a later story adds (test double for the safety review) is shown like any other | unit | boundary | ReadinessSummary.test.tsx |
| AC-005.8.2 | with no arrangements to show, nothing is presented as outstanding | unit | boundary | ReadinessSummary.test.tsx |
| AC-005.1.5 | the summary loads for the event; a failure is shown instead | unit | failure | EventReadinessCard.test.tsx |
| AC-005.7.2 | it is read again every 30 seconds, so changes by others appear without reloading | unit | normal | EventReadinessCard.test.tsx |
| AC-005.7.3 | it is read again at once when the page refreshes after a change made here | unit | normal | EventReadinessCard.test.tsx |
| AC-005.7.4 | once the page is left it stops reading and ignores a late answer | unit | boundary | EventReadinessCard.test.tsx |

## Manual test cases (shared Supabase, after 0076 is applied)

| ID | Steps | Expected |
|---|---|---|
| M1 | As a Coordinator, open an event assigned to you that has a held venue and an essential equipment item. | Readiness shows Venue booking and Equipment reservation as Outstanding, with links. |
| M2 | As Venue Staff, approve the booking; back as the Coordinator, wait up to 30 seconds. | Venue booking turns Complete without reloading. |
| M3 | Open the same event as another Coordinator. | No readiness card. |

## Coverage and forced break

`readinessService.ts`, `readinessLinks.ts`, `ReadinessSummary.tsx` and `EventReadinessCard.tsx`
are at 100% statements, branches, functions and lines (`types.ts` holds types only). The lines
added to `ReviewRequestDetailPage.tsx` are covered; its other gaps are from before. SQL has no
coverage tool; 0076 is covered case by case above.

Forced break: in `0076_event_readiness.sql`, the venue booking condition
(`complete := v_confirmed > 0 and v_waiting = 0 and v_held = 0`) was changed to
`complete := v_confirmed > 0`. AC-005.2.1 failed; the file was then restored.
Log: `docs/test-evidence/us5/AC-005.2.1-forced-break.log`.
