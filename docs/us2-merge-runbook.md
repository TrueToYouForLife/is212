# Merge and deploy runbook — structured event requirements

Two pull requests, then one deployment window. 74 files total.

Commands are written one per line because Windows PowerShell 5.1 does not support `&&`.

---

## Why the docs ride along with the code

`README.md` and `docs/us2-structured-requirements.md` go in **PR 1**, not a separate earlier
PR. Most of the README change describes behaviour that only exists once the code lands — the
new columns, the migration range `0001`–`0056`. Merging it first would leave main's README
documenting a main that does not do those things yet.

(The four backfilled sections for US6, US8, US9 and US11 *are* accurate today, since they
document existing behaviour. If a quick separate contribution is wanted, those four sections
can be split into their own PR first, but it means hand-splitting one file.)

---

## PR 1 — core change (69 files)

```powershell
git checkout main
git pull
git checkout -b feature/structured-event-requirements
```

Unzip the delivered files over the repo root first, then stage in seven commits. Committing
by concern lets each reviewer read only their own commits.

### Commit 1 — the migrations

```powershell
git add backend/supabase/migrations/0054_structured_event_requirements.sql
git add backend/supabase/migrations/0055_change_request_structured_requirements.sql
git add backend/supabase/migrations/0056_venue_booking_review_structured_requirements.sql
git commit -m "feat(db): store event requirements as catalogue codes (0054-0056)"
```

### Commit 2 — database tests and the runner

```powershell
git add backend/supabase/tests/structured_event_requirements.sql
git add backend/supabase/tests/run_change_request_review.sh
git add backend/supabase/tests/change_request_field_clarification.sql
git add backend/supabase/tests/change_request_revalidation.sql
git add backend/supabase/tests/change_request_review_history.sql
git add backend/supabase/tests/equipment_requirements.sql
git add backend/supabase/tests/event_registrations.sql
git add backend/supabase/tests/venue_booking_review_details.sql
git commit -m "test(db): code-list fixtures, 18 new checks, restore 0055 after replays"
```

**Expect a merge conflict in `run_change_request_review.sh`** — the same file that conflicted
between `us17-venue-access` and `main`. Resolve it by keeping both sides: the additions here
are `cat` lines for the 0055 restores and the new suite, not replacements.

### Commit 3 — the four new files

Grouped because they are all **net-new**: nothing existing is modified, and at this point
nothing imports them yet, so a reviewer can read the commit in isolation. Two of the four
are pure modules in the `CLAUDE.md` sense (no React, no Supabase, no I/O); the service
talks to Supabase and the controls are React, so this is not a "pure modules" commit.

```powershell
git add frontend/src/features/events/requirementCatalogue.ts
git add frontend/src/features/events/requirementCatalogueService.ts
git add frontend/src/features/events/components/RequirementControls.tsx
git add frontend/src/features/venues/searchTextMatch.ts
git add frontend/src/features/events/__tests__/requirementCatalogue.test.ts
git add frontend/src/features/venues/__tests__/searchTextMatch.test.ts
git commit -m "feat: add requirement catalogue, shared code controls and text matching

Four new files, nothing existing modified: the catalogue option lists and
helpers (pure), the service that loads layout_types and equipment_types,
the CodeSelect/CodeChecklist controls shared by both event forms, and the
normalised text matching for venue search (pure)."
```

| File | Pure? | What it is |
| --- | --- | --- |
| `venues/searchTextMatch.ts` | yes — imports nothing | case/space/punctuation-insensitive matching |
| `events/requirementCatalogue.ts` | yes | the option lists and `toggleCode`/`sameCodes`/`describeCodes` |
| `events/requirementCatalogueService.ts` | no — Supabase | loads `layout_types` and `equipment_types` |
| `events/components/RequirementControls.tsx` | no — React | `CodeSelect` and `CodeChecklist`, shared by both forms |

### Commit 4 — events feature (31 files)

```powershell
git add frontend/src/features/events/types.ts
git add frontend/src/features/events/validation.ts
git add frontend/src/features/events/draftValidation.ts
git add frontend/src/features/events/draftFormValues.ts
git add frontend/src/features/events/eventService.ts
git add frontend/src/features/events/eventDraftService.ts
git add frontend/src/features/events/eventDraftQueryService.ts
git add frontend/src/features/events/eventReviewService.ts
git add frontend/src/features/events/useEventRequestForm.ts
git add frontend/src/features/events/useEventChangeRequestForm.ts
git add frontend/src/features/events/changeRequestDisplay.ts
git add frontend/src/features/events/changeRequestSignificance.ts
git add frontend/src/features/events/changeRequestReviewValidation.ts
git add frontend/src/features/events/changeRequestReviewQueryService.ts
git add frontend/src/features/events/components/OptionalRequirementsFields.tsx
git add frontend/src/features/events/components/EventRequestForm.tsx
git add frontend/src/features/events/components/EventChangeRequestForm.tsx
git add frontend/src/features/events/components/RequestDetails.tsx
git add frontend/src/features/events/pages/SubmitEventChangesPage.tsx
git add frontend/src/features/events/__tests__/
git add frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx
git commit -m "feat(events): fixed requirement controls, prefilled change form, diff-based proposal"
```

### Commit 5 — venues consumers

```powershell
git add frontend/src/features/venues/types.ts
git add frontend/src/features/venues/venueSearchService.ts
git add frontend/src/features/venues/venueBookingReviewTypes.ts
git add frontend/src/features/venues/components/VenueFilters.tsx
git add frontend/src/features/venues/components/VenueBookingRequestDetails.tsx
git add frontend/src/features/venues/pages/VenueSearchPage.tsx
git add frontend/src/features/venues/__tests__/venueSearchService.test.ts
git add frontend/src/features/venues/__tests__/VenueFilters.test.tsx
git add frontend/src/features/venues/__tests__/VenueBookingRequestDetails.test.tsx
git add frontend/src/features/venues/__tests__/VenueSearchPage.suitability.test.tsx
git commit -m "feat(venues): apply a selected event's requirements to the search filters"
```

### Commit 6 — equipment consumers

```powershell
git add frontend/src/features/equipment/types.ts
git add frontend/src/features/equipment/equipmentRows.ts
git add frontend/src/features/equipment/equipmentRequirementService.ts
git add frontend/src/features/equipment/components/OrganiserEquipmentRequest.tsx
git add frontend/src/features/equipment/components/EquipmentRequirementsEditor.tsx
git add frontend/src/features/equipment/__tests__/
git commit -m "refactor(equipment): read the organiser's request as equipment_types codes"
```

### Commit 7 — documentation

```powershell
git add README.md
git add docs/us2-structured-requirements.md
git add docs/us2-merge-runbook.md
git commit -m "docs: structured requirements change log, plus US6/US8/US9/US11 README sections"
```

### Which README region belongs to which commit

`README.md` is one file, so staging it per commit means `git add -p`. Keeping it whole in
commit 7 is fine; this table is here for anyone who wants each commit self-documenting.
Line numbers are the post-change ones.

| Commit | README region | Lines |
| --- | --- | --- |
| 1 migrations | migration range `0001`–`0056` + the "apply 0054–0056 as a set" paragraph | 111–121 |
| 1 migrations | the whole `## US2/US6 structured event requirements` section | 937–988 |
| 1 migrations | `Structured requirements update (13 October)` in Shared Supabase state | 1201–1208 |
| 2 database tests | *nothing* | — |
| 3 new files | the `## Project structure` tree (now shows `venues/` and the new modules) | 539–575 |
| 4 events | the `## US6 organiser change requests` section | 175–205 |
| 5 venues | the `## US8 search and filter venues` section | 870–905 |
| 6 equipment | *nothing* | — |
| 7 docs | the `## US9 and US11 …` section, plus both files under `docs/` | 906–936 |

Two caveats if splitting it:

- The **US6 and US8 sections mix old and new.** Most of each documents behaviour that has
  been on main for weeks (`LOCKED_STATUSES`, withdrawal, the filter list, the
  `0018`/`0019a`/`0020` dependency); only some paragraphs describe this change. Splitting
  within a section is not worth it.
- The **US6, US8 and US9/US11 sections are documentation debt**, true with or without this
  change — US9 had zero README mentions despite 106 numbered tests. They would make a clean
  standalone PR needing nobody's approval, if an easy merge before the big one is wanted.

### Verify before pushing

```powershell
cd frontend
npx tsc --noEmit
npx vitest run
npx eslint .
npm run build
cd ..
bash backend/supabase/tests/run_change_request_review.sh
```

Expected: tsc clean, **993 app tests** passing (one pre-existing todo), lint clean, build
succeeds, **595 database checks** passing with Docker running.

Individual commits are **not** each green on their own — commit 4 needs 5 and 6 to typecheck.
That is fine: CI runs on the PR head, not per commit. Do not bisect within this PR.

```powershell
git push -u origin feature/structured-event-requirements
```

### Reviewers on PR 1

| Reviewer | Owns | Point them at |
| --- | --- | --- |
| **US7 owner** | review RPC, AC12 trigger | commits 1, 2, and the four `changeRequest*` files in commit 4 |
| **US13/US14 owner** | `equipment_types` | section 2 of `0054` in commit 1, the fixture in commit 2, commit 6 |
| **US10 owner** | booking review and approval | `0056` in commit 1, the fixture in commit 2, the two booking-review files in commit 5 |
| **US1 owner** | save draft | the four `draft*`/`eventDraft*` files in commit 4 |

Courtesy notice, no approval needed: whoever owns **US15/US29** — one existing assertion in
`event_registrations.sql` is extended so `facility_requirements` also cannot leak to Attendees.

---

## PR 2 — US18 label polish (5 files)

Open only after PR 1 merges.

```powershell
git checkout main
git pull
git checkout -b feature/us18-requirement-labels
git add frontend/src/features/venues/suitabilityTypes.ts
git add frontend/src/features/venues/suitabilityService.ts
git add frontend/src/features/venues/pages/VenueSuitabilityPage.tsx
git add frontend/src/features/venues/__tests__/suitabilityService.test.ts
git add frontend/src/features/venues/__tests__/VenueSuitabilityPage.test.tsx
git add README.md
git commit -m "feat(us18): show the organiser's requirements as catalogue labels"
git push -u origin feature/us18-requirement-labels
```

PR 2 carries a README change of its own, in the existing `## US18 venue suitability`
section (around line 989). The old text said the coordinator records requirements "beside
the organiser's own **words**" — codes are not words, so that sentence became wrong the
moment `0054` landed, and this is the commit that makes the page show labels. The change is
the four-word fix on that line plus a paragraph explaining that the verdict is still
computed from the coordinator's `event_venue_requirements` overlay.

Reviewer: **US18 owner**. Verified deferrable — with these five files at their current state
on main, tsc is clean and all 993 tests pass. Without them the suitability page shows raw
codes such as `wheelchair_access` instead of "Wheelchair access": untidy, not broken.

---

## Deployment window — after PR 1 merges

This change is **not backward compatible**. There is no ordering of "apply the schema" and
"deploy the client" that avoids a broken window, because the breaking step is the column type
conversion itself:

- apply `0054` while the old client is live → the organiser form posts a string to a `text[]`
  column and submitting an event request fails
- deploy the new client before `0054` → it posts an array to a `text` column, the same failure
  in reverse

So do it in one sitting, with the team told in advance:

1. In the Supabase SQL Editor, run **`0054`**, then **`0055`**, then **`0056`**, one file per
   run, checking each returns success.
2. Confirm with a read-only query:
   ```sql
   select column_name, data_type
   from information_schema.columns
   where table_schema = 'public' and table_name = 'events'
     and column_name in ('layout_preference', 'accessibility_requirements',
                         'facility_requirements', 'equipment_requirements');
   ```
   Expect `text`, `ARRAY`, `ARRAY`, `ARRAY`.
3. Deploy the frontend.
4. Read what the conversion could not map:
   ```sql
   select e.reference, n.*
   from public.event_requirement_migration_notes n
   join public.events e on e.id = n.event_id;
   ```
   Free text that matched no catalogue code is preserved here. Review it with the organisers
   and decide whether any of it should become a new `accessibility_types`, `facility_types` or
   `layout_types` row.
5. Smoke test in the browser: submit an event request with requirements ticked; raise a change
   request and confirm an untouched form proposes nothing; search venues for that event and
   confirm the filters are pre-applied.

Then update the **Shared Supabase state** section of `README.md` with the date applied, as the
team has done for every previous migration.
