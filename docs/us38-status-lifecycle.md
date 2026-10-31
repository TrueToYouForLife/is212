# US38 — Event status lifecycle (SCRUM-235)

Branch `us38-status-lifecycle`. Migration **0119** (applied to shared Supabase by Jaydon; not
yet confirmed as claimed with the team) and **0121** (not applied; apply after 0119). Code-first. Commits, PRs and deployment are Jaydon's.

## Decisions

| Question | Decision | Why |
|---|---|---|
| AC-038.1 lists 14 statuses; 13 existed | Add `postponed`. Keep "Returned for Clarification" as a display label (submitted + review note) | US4/US7/US22/US37 all depend on that shape; a real status would touch every one of them |
| Who postpones / resumes | The event's assigned Coordinator. Organiser and every other role cannot | 0039 already restricts direct event updates to the assigned Coordinator; the Organiser's only moves are submit and cancel. The UI shows the button to any Coordinator and the database refuses the others |
| Where Postponed comes from / goes | From Planning, In Preparation, Confirmed. To Planning (re-plans, safety review again) or Cancelled | Not Confirmed directly: a paused event should be re-checked before it is confirmed again |
| Side effects of postponing | None on bookings, reservations or registrations | Releasing them behind someone's back is not agreed |
| AC-038.9 history | Reuse US34's `event_audit_log` (0101); no second table | It already records every status change with actor and time as `status_changed`; Postponed and Completed arrive for free |
| AC-038.7 auto-complete | `complete_overdue_events()` scheduled hourly with pg_cron, guarded like 0062 | Same pattern the waiting list already uses; no JWT so no invented actor |
| AC-038.5 trigger | Organiser notified when Confirmed -> anything except Completed (new type `event_status_change`, in-app + email, follows US33 preferences) | Completing is the normal end, not a change |
| Approved significant change leaves Confirmed | Done in 0121: an AFTER INSERT trigger on `event_change_revalidations` (which 0055 writes only when an accepted field is significant) moves a Confirmed event to Planning in the approval's own transaction | Reuses 0055's definition of significant, so ordinary edits, rejections and provisional approvals never trigger it. Planning is the same place US45 sends events back to, so a re-review follows. Only Confirmed events move; US45 still owns events in or past safety review. Overlaps US45 AC-045.6 (SCRUM-302): tell Nicole it exists |

## Acceptance criteria

| AC | State |
|---|---|
| 038.1 | Done: 14 statuses (13 stored before, `postponed` added). Mapping of "Returned for Clarification" documented above |
| 038.2 | Done in 0119 (`is_valid_status_transition`, `enforce_event_status_transition`); mirrored in `statusRules.ts` |
| 038.3 | Not changed. Approval is a status update only; AC-038.3.1 checks no venue or equipment booking is created |
| 038.4 | Existing guards (tested by AC-038.4.1–5) already refuse planning writes on closed events (0024, 0025, 0035, 0099, 0102). Postponed is deliberately not in those lists, so a postponed event takes no planning actions until resumed |
| 038.5 | Done: notice (0119) and the move out of Confirmed on an approved significant change (0121) |
| 038.6 | Done in the status trigger and in the UI (button hidden until the end has passed) |
| 038.7 | Done: `complete_overdue_events()` + hourly job |
| 038.8 | Done: Completed is terminal, details are read-only (0008 guard, AC-038.8.1–2), the record stays readable (.3) and the active list omits it (AC-038.8.4) |
| 038.9 | Done by US34's audit trail |

## Test cases

Frontend: `postponedStatus.test.ts` (AC-038.1.1, .2.1–6, .6.1–3) and `CoordinatorActiveEvents.test.tsx`
(AC-038.8.4). Database: `event_status_lifecycle.sql`.

| AC | Positive | Negative | Boundary |
|---|---|---|---|
| 038.1 | .1.1 (app), .1.2, .1.4 | .1.3 unknown status refused | exactly 14 |
| 038.2 | .2.1, .2.2, .2.6 (app); .2.6, .2.11, .2.13 (SQL) | .2.3, .2.4; .2.7–.2.10, .2.12, .2.14–.2.18 | closed statuses reach nothing (.2.14) |
| 038.3 | .3.1 approval writes no booking | | |
| 038.4 | | .4.1–.4.5 requirements refused on Completed, Cancelled, Rejected, Withdrawn, Postponed | |
| 038.5 | .5.1, .5.3 notice on postpone, cancel; .5.5–.5.7 approved significant change moves Confirmed to Planning, notifies, is audited | .5.2 completing is not announced, .5.4 never-confirmed event; .5.8 ordinary change, .5.9 rejected change, .5.10 not-yet-confirmed event, .5.11 no manual move; .5.12 (app) | |
| 038.6 | .6.1, .6.5 | .6.2, .6.3, .6.4 | ending exactly now counts as ended (.6.2) |
| 038.7 | .7.2, .7.3 | .7.1, .7.5 | 7 days less / plus a minute (.7.3); idempotent (.7.4) |
| 038.8 | .8.3 stays readable, .8.4 | .8.1, .8.2 edits refused | |
| 038.9 | .9.1–.9.3 | | |

Next IDs: .1.5, .2.19, .3.2, .4.6, .5.13, .6.6, .7.6, .8.5, .9.4.

Existing expectations changed because Postpone now appears in the action lists:
`safetyReviewStatuses` (AC-043.1.9/.10), `safetyReviewSwitchedOff` (AC-043.1.19), `statusRules`
(AC-LIFECYCLE.1) and `RequestStatusPanel` (AC-LIFECYCLE.3). `reviewActionsFor` now takes the event's
end, so those cases pass a past end.

## Known gaps

- **Database cases:** `run_change_request_review.sh` passed (exit 0) with Docker. The quarter-hour/fresh
  runner and the US24 return-race tests time out on the authoring machine on clean main as well
  (lock-wait statement timeouts at a different step each run); check them in CI.
- **0121 and US45:** a Confirmed event with a flagged arrangement is not moved by US45 (0118 only moves
  events in or past safety review); only an approved significant change moves it, via 0121.

- The coordinator workload RPC (0041) lists active statuses by name and has never included the
  safety stages; it also omits Postponed. Counts for those events are understated. Separate fix.
- `complete_overdue_events()` updates events with no JWT, so any other BEFORE UPDATE trigger on
  `events` runs as it would for an administrator. Untested against the full set.
- Run: `bash backend/supabase/tests/run_change_request_review.sh` (Docker). 0119 and 0121 are replayed
  after 0118 in both runners.
