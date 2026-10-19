# US47 booking-time conversion — review and deployment

## Scope

Migration 0075 and the frontend changes are one coordinated release. They convert
venue booking occupancy to 96 quarter-hour cells per Singapore calendar day and
use each venue's setup/turnaround minutes. Saved occupancy is expanded from its
actual old slot boundaries, not recomputed from event dates. Original booking IDs,
requesters, statuses and block ownership remain recorded.

This slice does not expose duration settings to Venue Staff or implement notifications
when those settings change. The 0074 browser guard remains until that later slice.
It retains the existing one-active-hold-per-event rule and three-calendar-day default;
it does not redefine US11 expiry or implement multiple concurrent holds per event.

## Before merge

- Review 0075 with the owners of venue booking/approval, blocking and venue management.
  Shared changes include the atomic hold RPC, approval/version calculations,
  arrangement revalidation, block slot selection and quarter-hour opening hours.
- Check all CI steps: frontend coverage/build; pre-conversion DB regressions;
  quarter-hour upgrade/concurrency; fresh migration ordering.
- Manually verify in a disposable/staging environment with 0074 and 0075 applied:
  - Search and suitability exclude setup-only and turnaround-only conflicts.
  - Timetable/preview show quarter hours; midnight setup includes the previous date.
  - Assigned coordinator places, submits and releases a hold; staff approve it.
  - A conflicting hold is refused without leaving a booking or losing another reservation.
  - Organiser sees approved saved venue slots; pending bookings remain hidden.
  - Staff preview/create/remove a quarter-hour maintenance block and a full-day block.
  - Converted older blocks retain their gaps; converted bookings retain saved occupancy.
  - Add/edit venue hours accept quarter-hour values and reject invalid ordering.
- Record actual manual results in the evidence sheet. Automated component tests do
  not establish that these shared-environment checks passed.

## Deployment

1. Arrange a short booking/blocking maintenance window; prevent old browser clients
   from writing while the database and frontend are switched together.
2. Confirm a recoverable database backup and compare the live function definitions
   with main, particularly any team changes made since this PR was reviewed.
3. Confirm 0074 exists. Apply 0075 once through the team's agreed SQL deployment
   process. Do not edit/reapply historical migrations to install this change.
   Both upgrade-after-later-migrations and numeric-order fresh installs are tested.
4. Deploy the matching frontend and refresh open browser sessions before restoring
   booking/blocking access. No new feature flag is introduced by this slice.
5. Run the manual smoke checks above and record the applied migration with the team.

0075 is transactional and aborts on unsupported legacy boundaries or overlapping
converted claims rather than silently dropping data. If it fails, investigate the
error before retrying. If rollback is required after successful deployment, restoring
only the old frontend is insufficient; restore a coordinated database/frontend
backup. There is no automatic reverse conversion in this PR.

## Verification architecture

The existing DB runner intentionally excludes 0075: its historical AM/PM/Night
fixtures and replay checks verify the pre-conversion baseline. CI additionally runs
`run_venue_time_conversion.sh` for an upgrade of populated data and with `fresh` for
numeric migration order. These run preservation, replay, calculation, blocking,
hold, approval, revalidation, operating-hour and concurrency cases on the converted
schema. Passing the historical suite alone is not sufficient to approve this PR.

Legacy frontend slot helpers/types remain for historical fixtures; production hold
creation and preview no longer use the fixed one-slot setup/turnaround calculation.
