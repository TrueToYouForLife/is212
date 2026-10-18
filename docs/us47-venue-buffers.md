# US47 — Configure venue setup and turnaround

Owner: Jaydon. Story: SCRUM-242. Updated: 19 October 2026.

## Agreed direction

Venue setup and turnaround are independent durations in non-negative multiples of
15 minutes, defaulting to zero. Availability and conflict checks must include both
durations. Existing bookings and holds that become conflicting must remain recorded,
be flagged for review, and notify their Coordinators and Venue Staff.

The earlier on/off AM/PM/Night interpretation is superseded. The supporting change
to 15-minute bookings is included in this work. Development is code-first, with
short-lived branches and small coherent PRs.

## Foundation checkpoint — migration 0074

Branch: `us47-venue-buffer-settings`.

- Adds `venues.setup_minutes` and `venues.turnaround_minutes`, with zero defaults,
  NOT NULL and non-negative/multiple-of-15 constraints.
- Adds internal `venue_occupied_period(start, end, setup_minutes, turnaround_minutes)`.
  It returns an exact half-open timestamp range. For a 10:00–12:00 event with
  30-minute setup and 45-minute turnaround, the result is 09:30–12:45.
- Rejects null/non-finite or unordered event times and invalid buffer durations.
- Does not round event timestamps, allocate cells, change existing reservations,
  or replace the current booking calculations.
- Browser writes to these new fields are temporarily blocked, including Venue
  Staff writes, because current booking logic does not consume them yet. Existing
  venue edits continue to work. Trusted database operations can set valid values.
- No new public RPC or user interface is exposed. The later integration must
  replace the temporary guard with the final authorised save/review workflow.

This is partial implementation, not completion of AC-047.1 or AC-047.2. AC-047.3
is not implemented by this migration. Tests and evidence are recorded in
[US47 test cases](test-cases/US47_test_cases.md).

## Remaining portions

1. Integrate venue duration configuration with 15-minute booking creation,
   holds, approval, search, suitability, maintenance blocks and calendar displays.
2. Preserve existing occupied periods when converting legacy reservations and
   update historical-migration replay checks alongside affected consumers.
3. Detect conflicts caused by settings changes, preserve reservations, and
   record review flags and notifications for Coordinators and Venue Staff.
4. Complete regression checks, browser verification and shared evidence records.

Migration 0074 has not been applied to shared Supabase. Commits, pushes and PRs
are performed manually. No manual UI pass is claimed for this internal foundation.
