# Structured event requirements (US2/US6/US8, with US7/US10/US13/US18 impact)

Turns the organiser's four requirement fields from free text into fixed catalogue
choices, so a coordinator searching venues for an event can have the event's own
requirements become the search filters.

## Why this was not just a UI change

`frontend/src/features/venues/types.ts` used to carry this comment on
`AssignedEventOption`:

> The free-text fields are shown to the coordinator as read-only reference — they aren't
> structured, so they can't be matched against a venue automatically.

Converting the controls to a dropdown and checkboxes without changing anything else would
have left that comment true: the values still landed in `events.accessibility_requirements
text`, which cannot be compared to `venues.accessibility text[]`. The UI is the smallest
part of this change.

## The four fields

| Field | Shape | Catalogue | Filters venue search? |
| --- | --- | --- | --- |
| `layout_preference` | one code, nullable | `layout_types` (0021) | yes, against `venues.layout` |
| `accessibility_requirements` | `text[]` | `accessibility_types` (new) | yes, against `venues.accessibility` |
| `facility_requirements` | `text[]`, **new column** | `facility_types` (new) | yes, against `venues.facility` keys |
| `equipment_requirements` | `text[]` | `equipment_types` (0019) | no — see below |

**Facility and equipment are deliberately separate.** A projector fixed in the ceiling is
a property of the room and is what the venue search filter matches. A projector on a
trolley is equipment, reserved through US13/US14, and is not a property of any venue. The
form previously had only `equipment_requirements`, so a fourth field was added rather than
overloading one list to mean both.

**There were no accessibility or facility catalogue tables.** The codes existed only in
`frontend/src/features/venues/venueFeatureCatalogue.ts`, whose own comment said
"Placeholder codes from US8 until a catalogue table exists". Even
`event_venue_requirements` (0023) stored them as bare `text[]` with no foreign key. 0054
creates the tables and seeds them from that file, so the database now enforces what the UI
offers.

## Migrations

All three are additive and safe to replay. **None has been applied to shared Supabase.**

### `0054_structured_event_requirements.sql`

1. Creates `accessibility_types` and `facility_types` (`code`, `label`, `sort_order`),
   seeded to match `venueFeatureCatalogue.ts` exactly. Readable by every signed-in role.
2. Adds `equipment_types.code`, a stable slug, backfilled from `name` with de-duplication.
   A `BEFORE INSERT OR UPDATE` trigger fills it in, so **every existing insert into that
   table keeps working** — Technical Support adding a type, and several other stories'
   fixtures, all name a type without a code. The browser may read the code but not set it.
3. **Widens `equipment_types` read access** from `coordinator, tech_support` to every
   signed-in role. Without this the organiser's equipment checkboxes render empty with no
   error to explain why. Writes are untouched: still `tech_support` only.
4. Creates `event_requirement_migration_notes` and copies the existing free text into it
   before the conversion, so nothing an organiser actually typed is lost. Staff-readable,
   no browser writes.
5. Converts the `events` columns, mapping old free text onto codes case- and
   punctuation-insensitively ("Wheelchair Access." → `wheelchair_access`). Unmappable text
   becomes empty/null and survives in the notes table. Adds `facility_requirements`, and a
   real foreign key from `layout_preference` to `layout_types(code)`.
6. Adds `events_validate_requirement_codes`, a `BEFORE INSERT OR UPDATE` trigger that
   refuses any code not in its catalogue and collapses duplicates. A trigger rather than a
   `CHECK` because a `CHECK` cannot read another table, and rather than a foreign key
   because PostgreSQL has no per-element foreign key for arrays.
7. `grant select (facility_requirements) on public.events to authenticated` — 0005 revoked
   table-wide SELECT and re-granted column by column, so a new column is otherwise
   invisible, and the failure is silent.

### `0055_change_request_structured_requirements.sql`

Replaces `review_event_change_request`. 0013's version insists every proposed value except
`registrationRequired` is a JSON string:

```sql
if jsonb_typeof(proposed_value) is distinct from
  (case when field_name = 'registrationRequired' then 'boolean' else 'string' end) then
```

A requirement proposal now arrives as a JSON array, which that check rejects outright with
"Invalid proposed value type". The replacement knows which fields are lists, validates
every element is a non-blank string, and applies a list by assignment. Everything else —
locking order, version checks, the `updated_at` guard, the 0010 provisional-clarification
behaviour — is carried over unchanged. `reply_to_change_request` is **not** replaced: it
only validates the organiser's answer text, never the proposed values.

Also adds `facilityRequirements` to `queue_change_request_revalidation` (US7 AC12): it is a
venue requirement in exactly the way layout and accessibility are, so it queues a venue
recheck.

### `0056_venue_booking_review_structured_requirements.sql`

Replaces `get_venue_booking_review` so Venue Staff see the organiser's requirements as code
lists: `accessibilityNotes` becomes `accessibilityRequirements`, and `facilityRequirements`
is added. The coordinator's US18 overlay keys (`requirementsRecorded`, `layout`,
`accessibility`, `facilities`) are returned exactly as before.

Also adds `facility_requirements` to `venue_booking_review_version`, so adding a facility
requirement after the review screen was loaded invalidates the approval — the same rule
0045 already applies to layout and accessibility.

> **Base a replacement of this function on 0045, not 0044.** 0044 defines an earlier
> version; replacing it with that one silently drops the `reviewVersion` key and every
> approval then fails with "Request changed; reload before approving". This cost four
> failing database checks before it was caught.

## Your question: should the change request form prefill?

**Yes for the fixed controls, no for the free text.** They have to differ, because they can
express different things:

- A blank text box unambiguously means "I am not proposing anything here".
- A blank dropdown does **not**. `''` is a real choice — "no layout preference" — so blank
  cannot also mean "no change".
- An empty checkbox group is a real proposal too: "drop every accessibility requirement".
  Under the old blank-means-no-change rule that request was literally impossible to make.

So there is no third state left for a select or a checkbox to hold, and "no change" has to
be expressed as "unchanged from what was shown" and detected by comparison.
`collectChanges` now diffs the four fixed fields against the event's current values and
proposes only what moved. Submitting an untouched form proposes nothing, which matters
because every proposed field costs the coordinator a decision and a note.

A requirement field in a proposal is the **complete list** the organiser wants to end up
with, never a delta. That is what lets the review RPC apply an approved field by
assignment; a delta would need merge rules, and a merge rule applied to a partly approved
review would be guesswork.

`registrationRequired` is still excluded: a plain checkbox cannot say "no change" and it is
not prefilled from the event, so a diff would be meaningless. It needs a tri-state control,
which is separate work.

## Case, blanks and punctuation in the text filters

`frontend/src/features/venues/searchTextMatch.ts` reduces both sides of a comparison to
their letters and digits, lower case (NFKD first, so accents decompose). `ilike '%...%'`
only ignores case: it still treats "Level 2." and "level 2" as different, so a trailing
full stop produced "No venues match" for a venue sitting right there.

This is why `keyword`, `location` and `layout` are now filtered in the browser rather than
in the query: the stored value keeps its punctuation, so a stripped search term cannot
match it with `ilike` however the pattern is written. Capacity and accessibility are still
narrowed by the database. A filter made only of spaces or punctuation matches everything —
typing "." is not a filter.

The same reduction fixes a second problem: `venues.layout` was repaired from older data by
0019a and holds values like `Hall` and `U-shape`, while `layout_types` holds `hall` and
`u_shape`. Both now reduce to the same key.

## Files changed

### Backend

| File | Change |
| --- | --- |
| `migrations/0054_structured_event_requirements.sql` | **new** — catalogues, column conversion, validation trigger, grants |
| `migrations/0055_change_request_structured_requirements.sql` | **new** — array-aware review RPC, facility in revalidation |
| `migrations/0056_venue_booking_review_structured_requirements.sql` | **new** — booking-review details and version hash |
| `tests/structured_event_requirements.sql` | **new** — 18 checks |
| `tests/run_change_request_review.sh` | restores 0055 after each historical 0010/0013/0015 replay; runs the new suite plus a replay check |
| `tests/change_request_field_clarification.sql` | proposal value is a code list; brings its own equipment type |
| `tests/change_request_revalidation.sql` | proposals are code lists; brings its own equipment types |
| `tests/change_request_review_history.sql` | the retained snapshot holds a list, not a string |
| `tests/equipment_requirements.sql` | organiser fixture is codes |
| `tests/event_registrations.sql` | `facility_requirements` added to the "no internal fields leak to Attendees" assertion |
| `tests/venue_booking_review_details.sql` | fixture and expected JSON keys |

> The runner needed four `cat 0055` restores. Its own comment already explains the pattern:
> *"Replay later replacements too: replaying 0008 alone would restore an old RPC."* The
> same is true of 0010, 0013 and 0015 — each replays a historical version of a function
> that 0055 replaces, and the tests that follow then run against the obsolete one.

### Frontend — new

`events/requirementCatalogue.ts` (pure: option lists and helpers),
`events/requirementCatalogueService.ts` (loads `layout_types` and `equipment_types`),
`events/components/RequirementControls.tsx` (`CodeSelect`, `CodeChecklist`, shared by both
forms so they cannot offer different options), `venues/searchTextMatch.ts` (pure).

`requirementCatalogue.ts` imports the accessibility and facility codes from the venues
feature rather than redeclaring them. That cross-feature import is the point: a second copy
in the events folder would be free to drift, and a drifted code silently matches nothing.

### Frontend — changed

Events: `types.ts`, `validation.ts`, `draftValidation.ts`, `draftFormValues.ts`,
`eventService.ts`, `eventDraftService.ts`, `eventDraftQueryService.ts`,
`eventReviewService.ts`, `useEventRequestForm.ts`, `useEventChangeRequestForm.ts`,
`changeRequestDisplay.ts`, `changeRequestSignificance.ts`,
`changeRequestReviewValidation.ts`, `changeRequestReviewQueryService.ts`,
`components/OptionalRequirementsFields.tsx`, `components/EventRequestForm.tsx`,
`components/EventChangeRequestForm.tsx`, `components/RequestDetails.tsx`,
`pages/SubmitEventChangesPage.tsx`.

Venues: `types.ts`, `venueSearchService.ts`, `suitabilityTypes.ts`, `suitabilityService.ts`,
`venueBookingReviewTypes.ts`, `components/VenueFilters.tsx`,
`components/VenueBookingRequestDetails.tsx`, `pages/VenueSearchPage.tsx`,
`pages/VenueSuitabilityPage.tsx`.

Equipment: `types.ts`, `equipmentRows.ts`, `equipmentRequirementService.ts`,
`components/OrganiserEquipmentRequest.tsx`, `components/EquipmentRequirementsEditor.tsx`.

## Which stories are impacted, and who needs to review

| Story | What changed | Needs their review |
| --- | --- | --- |
| **US2** Submit Event Request | The four controls, validation, the columns | owner (you) |
| **US1** Save Draft | Draft save/load carry code lists; an omitted requirement is `[]`, not `null` | low risk, same owner |
| **US6** Organiser Requesting Changes | Prefilled fixed controls, diff-based proposal | owner (you) |
| **US7** Coordinator Reviewing Change Requests | `review_event_change_request` replaced; `changeRequestReviewValidation` accepts arrays; `facilityRequirements` added to significance and to the AC12 revalidation trigger | **yes — RPC owner** |
| **US8** Search & Filter Venues | Layout is a dropdown; a selected event's requirements become the filters; text matching normalised | owner (you) |
| **US10** Venue Booking Review/Approval | `get_venue_booking_review` keys renamed; `venue_booking_review_version` now hashes `facility_requirements` | **yes — US10 owner** |
| **US13** Record Equipment Requirements | `equipment_types.code` added; its read policy widened; the organiser's request renders as a named list | **yes — US13/US14 owner** |
| **US14** Equipment Reservations | Only via `equipment_types`; no reservation logic touched | notify |
| **US15/US29** Attendee views | No code change; one existing assertion extended so the new column also cannot leak | notify |
| **US18** Check Venue Suitability | `SuitabilityEvent` carries code lists; the page shows labels. The assessment still runs off the coordinator's own overlay | **yes — US18 owner** (see follow-up) |

## Recommended follow-up, not done here

`event_venue_requirements` (0023) exists because the organiser's fields were free text — its
own comment says so: *"The organiser's layout/accessibility fields are free text (US2) and
cannot be matched against a venue, so the assigned coordinator records a structured version
here."* That reason is now gone, so the coordinator is retyping information the organiser
already supplied in the same vocabulary. Consolidating the two belongs in a US18 PR with
that story's owner, not here — removing it unilaterally would break their tests and their
story. Until then both exist, and the venue search filters come from the event while the
suitability verdict comes from the overlay.

Also worth doing later: make the accessibility and facility option lists read from the new
tables rather than from `venueFeatureCatalogue.ts`, so Venue Staff can add an option without
a code change — the reason the tables are tables. Today the seed and the file are identical,
so behaviour is the same either way, and leaving the file in place avoided touching US8 and
US18 components.

## Test IDs added

Confirm these against the README allocation table before merging — they continue the
highest unused number I could find in the repo, but a teammate's unmerged branch may have
claimed some.

| Where | IDs |
| --- | --- |
| `events/__tests__/requirementCatalogue.test.ts` | AC-002.1.7 – .14 |
| `events/__tests__/changeRequestDiff.test.ts` | AC-006.3.7 – .17 |
| `venues/__tests__/searchTextMatch.test.ts` | AC-008.1.1 – .11, AC-008.2.1 – .5 |
| `venues/__tests__/VenueFilters.test.tsx` | AC-008.3.1 – .6, AC-008.4.1 – .3 |
| `venues/__tests__/venueSearchService.test.ts` | AC-008.5.1 – .7, AC-008.6.1 – .2 |
| `tests/structured_event_requirements.sql` | AC-002.1.15 – .25, AC-007.9.18 – .22, AC-007.12.20 |
| `tests/run_change_request_review.sh` | AC-002.1.26 (replay) |

No existing ID was renumbered or reused. US8 had no numbered cases at all before this, so
AC-008 criteria numbering is my reading of the story and should be checked against Jira.

## Verification run (12 October 2026)

- `npx tsc --noEmit` — clean
- `npx vitest run` — **993 passed**, 1 pre-existing todo, 106 files (was 940/101)
- `npx eslint .` — clean
- `npm run build` — succeeds
- Database suite — **589 checks pass** (baseline on the untouched zip: 571). The six
  remaining failures are concurrency tests (AC-014.12.2/.3/.5, AC-015.5.4, AC-015.6.4,
  AC-023.5.7) that fail **identically on the unmodified baseline** in this sandbox because
  they need the real Docker container's second session; run
  `bash backend/supabase/tests/run_change_request_review.sh` with Docker to confirm them.

Two real bugs were found and fixed during verification rather than by inspection:

1. The validation trigger originally compared `a.code = code` against an `unnest(...) as
   code` alias. PostgreSQL resolved the bare name to the catalogue's own column, making the
   test `a.code = a.code` — so **every invalid code was silently accepted**. The unnested
   column is now aliased explicitly.
2. `ALTER COLUMN ... USING` refuses a subquery, and the guarded legacy-notes `INSERT` still
   fails type-checking once the columns are arrays. The conversion now goes through a helper
   function and the insert through `EXECUTE`, which is what makes replay work.

## Still to do

- Apply 0054, 0055 and 0056 to shared Supabase, in that order, after the PRs land.
- Browser verification of the organiser form, the change request form and venue search
  against real data — nothing here proves the live flow.
- A check on existing shared-database rows: read
  `event_requirement_migration_notes` after applying 0054 to see what free text could not
  be mapped, and decide with the organisers whether any of it should become a new catalogue
  option.
