# Change log: requirement changes in the final sprint (Sprint 4, Release 1)

How acceptance criteria that changed late were handled. In a normal sprint a changed AC on a Done
story would be re-planned as new backlog work. In the final sprint there is no later sprint, so:

- an AC that **later stories already delivered differently** is marked superseded on the Done story,
  with the old wording, the reason and a link to the story that delivered it; nothing is reopened;
- an AC that is **genuinely unmet** gets a new item linked to its story, fixed in this sprint or
  listed as a known limitation of the submission;
- every change is recorded here, in the story's Jira description (a dated note) and in its tests.

## Acceptance criteria changed or superseded

| Date | Story | AC | Change | Old wording | Reason | Decided by | Tests | Jira |
|---|---|---|---|---|---|---|---|---|
| 1 Nov 2026 | US21 (SCRUM-66) | AC-021.2 | Revised: a rescheduled event returns to Planning with its bookings kept but flagged for review; a postponed event keeps its bookings and reservations. | "If there is no date/time decided, current bookings are released but event records are maintained until a new date is provided." | Conflicted with team proposal #70, implemented in US38 (0119: postponing changes no booking, reservation or allocation; 0121: leaving Confirmed flags arrangements for review). US21 was still in progress, so this was refinement, not a reopen. | PO (Jeremiah), with the team | AC-021.2.1, AC-021.3.3, AC-021.4.1 (0122) | SCRUM-66 note |
| 3 Nov 2026 | US9 (SCRUM-15) | AC-009.3 | Superseded: each venue booking carries its own layout and attendance, defaulting to the event's. | "The booking request includes the event's expected attendance and required layout, taken from the event record rather than re-entered." | US49 (multiple venues, Week 7 change 3, 0102). | PO | AC-049.2.x | SCRUM-15 note |
| 3 Nov 2026 | US9 (SCRUM-15) | AC-009.2, AC-009.5 | Superseded (wording kept, noted): exact quarter-hour times and venue-specific setup and turnaround minutes replace AM/PM/Night slots. | AM/PM/Night slots; adjacent slots for setup/turnaround | US47 (Week 7 change 1: 0074, 0075, 0098). | PO | AC-047.2.9, AC-047.2.12 | SCRUM-15 note |
| 3 Nov 2026 | US11 (SCRUM-16) | AC-011.4 | Superseded: an event may hold several venues at once; each venue's time still carries one hold or booking. | "An event can have at most one active tentative hold at a time." | US49 (0102 removed the one-active-hold-per-event limit). | PO | AC-049 suites; AC-047.2.10 | SCRUM-16 note |
| 3 Nov 2026 | US11 (SCRUM-16) | AC-011.9 | Revised: holds are released on cancellation or withdrawal; a postponed event keeps its holds. | "...released automatically when its event is cancelled, postponed or withdrawn." | Team proposal #70 / US38 (0119). Cancelling releases holds (0035; US21's 0120). | PO | AC-021.1.1 (0120) | SCRUM-16 note |
| 3 Nov 2026 | US11 (SCRUM-16) | AC-011.1, AC-011.3 | Superseded (wording kept, noted): quarter-hour times replace slots. | AM/PM/Night slots | US47 (Week 7 change 1). | PO | AC-047.2.9, AC-047.2.10, AC-047.2.12; AC-012.5.6 | SCRUM-16 note |
| 3 Nov 2026 | US11 (SCRUM-16) | AC-011.10 | Unchanged, found **unmet** by the final-sprint test audit: the suitability check and alert exist (US18) but the hold flow does not use them. | — | Raised as a new linked item rather than reopening US11. | PO | to be added under AC-011.10 | SCRUM-343 |

## Release decisions in the final sprint

| Date | Change | Why | Effect on tests | PR |
|---|---|---|---|---|
| 3 Nov 2026 | Removed the venue feature flags (`VITE_FEATURE_VENUE_BOOKING`, `_BLOCKS`, `_SUITABILITY`, `_MANAGEMENT`): their screens are always on. | Their stories (US9-US11, US12, US18, US46) were Done; the flags defaulted off, so a fresh install hid core features. | Three flag-off tests retired: AC-012.1.12, AC-012.8.25 (US12), AC-019.1.16 (US19). | #172 (remove-venue-flags) |
| pending | Switched on the safety review (0123) and removed `VITE_FEATURE_SAFETY_REVIEW`. | Week 7 change 6 must be in the submission; every piece on its checklist (0110, US44, US26, US45) was deployed. | AC-043.1.20 added; AC-043.1.19 and AC-043.4.16 retired; five frontend tests now confirm from In Preparation (AC-026.1.5, AC-026.1.6, AC-LIFECYCLE.1, .3, .5). | switch-on-safety-review |
| 2 Nov 2026 | US26 rebuilt on 0115 and renumbered 0113 -> 0117. | 0115 (US37) replaced the same status trigger and merged first; 0113 would have removed or been removed by it. | None (same behaviour). 0113 is unused. | US26 PR |

## Known limitations of the submission

Anything still open at submission is listed here with its reason.

| Item | Status | Reason |
|---|---|---|
| AC-011.10 (SCRUM-343) | open | Fix in progress in the final sprint; remove this row once merged. |
