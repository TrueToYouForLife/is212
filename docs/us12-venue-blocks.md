# US12 Block Venue Availability (SCRUM-14)

Venue Staff block a venue for maintenance, equipment failure, renovation, safety or other
operational reasons, for chosen slots on one date or a range. Week 7 change 2 shapes the
story: a block may land on bookings that already exist, and those bookings are **flagged
for review, not cancelled**. Their coordinators are told, and the original booking is kept
so they can arrange an alternative.

## What users can do

**Venue Staff** (`/venues/blocks`, nav item **Venue blocks**):

1. Choose a venue (retired venues are not offered).
2. Enter a first and last day, one or more slots (Full day is all three) and a reason.
3. **Preview**: the bookings the block would overlap (event, status, and which cells: the
   event itself, or its setup or turnaround), and any existing block it would overlap.
4. **Confirm block**, offered only while the preview matches what is entered, and disabled
   if it overlaps an existing block. The form then says how many bookings were flagged.
5. See the venue's current blocks (dates, slots, reason, who blocked and when) and remove
   one after confirming.

**Event Coordinators** (`/venues/alerts`, nav item **Venue alerts**): their open flagged
bookings, with event, venue, affected slots, reason and when flagged, and a link to the
request.

Both pages are always on (the `VITE_FEATURE_VENUE_BLOCKS` flag was removed once US12 was done).

## Design decisions

| Decision | Why |
| --- | --- |
| A block is a `venue_closures` row plus one `maintenance` cell per date and slot in `venue_slot_claims` | The ledger's primary key (venue, date, slot) is the one hard block for every kind of occupancy, so a booking, its setup/turnaround buffer and a block can never share a cell, even when two writers race |
| Bookings inside a new block are flagged, not cancelled | Week 7 change 2. The block takes only free cells; a booked cell stays with its booking until the booking lets go, when a trigger hands it to the block |
| Blocks change only through `block_venue()` and `remove_venue_block()` | A direct insert would skip flagging and notification, so browser writes to `venue_closures` and `maintenance` cells are revoked (0026) |
| Functions are `security definer`, `search_path = ''`, and executable by `authenticated` only | New functions are executable by `anon` unless revoked; internal helpers are revoked from `authenticated` too |
| Saving is one transaction | The block, its cells, its flags and its emails succeed or fail together |
| A flagged booking cannot be confirmed; an already confirmed one stays confirmed | The room won't be usable then, but a confirmation is never quietly undone; the coordinator acts on the flag |
| Saving a block releases lapsed holds on its venue | 0018 releases holds only when someone next books, so a dead hold would otherwise sit on a cell the block should own (Week 7 change 4; full hold expiry is US11's) |
| Removal is soft | The row keeps who blocked, why, and who removed it and when (AC-012.10) |
| `venue_booking_flags` is generic | US46, US47 and US48 can reuse it for other causes; this story writes only `venue_blocked` |
| The form's checks mirror the database's | They exist to put a message beside the field; the database stays the control |
| A preview counts only for the venue, dates and slots it checked | Editing those hides Confirm until previewed again, so staff can't confirm a block they haven't seen the effect of |
| A lost reply to `block_venue` says "could not confirm", not "nothing changed" | The call may have committed even though its reply was lost |

## Files

**Database** (`backend/supabase/migrations/`): `0026_venue_closures_lock_writes.sql`,
`0027_venue_block_validation.sql`, `0028_venue_block_cells.sql`,
`0029_venue_block_preview.sql`, `0030_venue_block_flags.sql`,
`0031_venue_block_flag_access.sql`, `0032_venue_block_triggers.sql`,
`0033_venue_block_removal.sql`, `0034_venue_block_skip_removed.sql`. The README's US12
section says what each adds.

**App** (`frontend/src/`):

| File | Role |
| --- | --- |
| `features/venues/venueBlockTypes.ts` | Block, preview and flag shapes |
| `features/venues/venueBlockValidation.ts` | Pure form rules, `sameBlock`, `groupAffectedBookings` |
| `features/venues/venueBlockService.ts` | Venue Staff calls: venues, create, preview, list, remove |
| `features/venues/venueAlertService.ts` | Coordinators' open flags |
| `features/venues/slotFormat.ts` | Gains `SLOT_LABELS` for the slot checkboxes |
| `features/venues/components/SlotPicker.tsx` | AM, PM, Night, and Full day |
| `features/venues/components/VenueBlockForm.tsx` | The block form: check, preview, confirm |
| `features/venues/components/VenueBlockPreview.tsx` | What a block would overlap |
| `features/venues/components/VenueBlockList.tsx` | Current blocks, with remove after confirming |
| `features/venues/pages/VenueBlocksPage.tsx` | The Venue Staff page |
| `features/venues/pages/FlaggedBookingsPage.tsx` | The coordinators' Venue alerts page |
| `components/layout/TopNav.tsx`, `App.tsx` | Nav items and routes, behind the flag |

Components take their service calls as props (`onPreview`, `onCreate`, `onRemove`), so
none imports Supabase (CLAUDE.md).

## Tests

63 database checks (`backend/supabase/tests/venue_blocks.sql`, plus AC-012.10.4 in the
runner) and 65 app tests (Vitest). The README's US12 section maps every test ID to its
criterion. Every criterion has at least one test, and the set includes boundary (exactly
366 days, 30 February), conflict (overlapping blocks, booked cells, setup and turnaround)
and failure (lost replies, refused calls, failed loads) cases.

Evidence of test-first development:

- Each cycle is a `test:` commit whose CI run failed, then a `feat:` commit that made it
  pass; `git log --oneline` on `main` shows the pairs.
- Access guards that passed on their first run have forced-break logs, made by breaking the
  rule temporarily and showing the test fail: AC-012.1.2, 1.3, 8.8 and 8.9.
- A few boundary and coverage tests passed on first run because the general code already
  covered them; each PR description names them.

## Known limits

- **AC-012.4 is partly US19's.** Blocked slots and their reasons are stored and shown on the
  blocks page; drawing them on an availability calendar is US19's job (linked in Jira).
- **No booking screen yet.** No page calls `holdVenue`, so blocking over a booking was
  demonstrated with a test hold inserted in the SQL Editor; the SQL tests cover every
  flagging path.
- **Hold expiry is lazy.** A lapsed hold is released when someone next books its venue or
  saves a block on it. Real expiry is US11's.
- **Roles.** The Event Coordinator Lead and Operations Manager are not given flag access;
  if they need it, their stories add a policy.
- **Concurrency.** Two staff blocking one venue at the same moment are serialised by a row
  lock in `block_venue()`. The single-session test runner can't show a race, so this is
  covered by design, not by a test.

## Trying it

Run the app and sign in as
Venue Staff to block a venue, then as a coordinator to see any flagged bookings under
**Venue alerts**.
