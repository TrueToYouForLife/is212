# US34 audit trail (SCRUM-231)

Migration `0101_event_audit_log.sql` (applied to shared Supabase by the user on 22 October 2026; treat as immutable, put any fix in 0102+).

## Design
- One append-only `event_audit_log` (actor, action, item, old/new values, time). Existing history
  tables keep their own purpose and access rules and are not merged into it.
- Written only by AFTER triggers in the same transaction as the action, so a failed log write
  rolls the action back. Triggers on `events` (status, assignment, rescheduling, significant
  fields), `venue_bookings` (confirmed/rejected/cancelled) and `equipment_booking_lines`
  (created, status or reserved quantity changed).
- AC-034.2: no write grants to users, plus a trigger that refuses update/delete/truncate even for
  the table owner.
- AC-034.3/.4: RLS and `get_event_audit_log(event)` allow only the assigned Coordinator and the
  Coordinator Lead. Everyone else gets 42501, not an empty list.
- Actor is `auth.uid()`; null for administrator or database changes. No actor is invented.
- Only future actions are recorded; no backfill.

## Not covered yet (follow-ups)
- Safety outcomes (US44 not built) and any rescheduling path other than changing the event dates.
- Names for coordinator changes: the log stores ids, and the view hides ids rather than show UUIDs, so a reassignment reads "Coordinator assigned or changed" with the actor and time only.
- Venue-booking expiry, holds and system housekeeping are deliberately not recorded.

## Tests
`backend/supabase/tests/event_audit_log.sql`: AC-034.1.1–12, .2.1–2, .3.1–4, .4.1–3 (21 cases),
run last by `run_change_request_review.sh`, which applies 0101 after all earlier fixtures.
Next IDs: AC-034.1.13, .2.3, .3.5, .4.4. Full suite passed; log in
`docs/test-evidence/us34/database-audit-log.log`. Written code-first. Forced-break runs for AC-034.2.1 and AC-034.4.4/.4.5 are recorded in `docs/test-cases/US34_test_cases.md`.

## Frontend view (SCRUM-289)
`frontend/src/features/events/audit/`: `auditService.ts` (only Supabase access, calls `get_event_audit_log`),
`auditDescription.ts` (pure wording), `AuditTrailCard.tsx`. Shown on the request detail page to the
assigned Coordinator and to the Coordinator Lead; a refusal is shown as an error, never an empty trail.
No polling; reloads with the page's Refresh. Tests: AC-034.3.5–14 and AC-034.4.4–7 (15 cases, three files
under `audit/__tests__/` plus `__tests__/AuditTrailPage.test.tsx`). Next IDs: AC-034.3.15, .4.8.
Frontend: 177 files / 1,530 tests passed; typecheck, lint and build passed. Not yet checked in a browser.
