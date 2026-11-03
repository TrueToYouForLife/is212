-- Switch on the safety review (Week 7 change 6: US43, US44, US45).
-- 0108 added the safety review switched off, so the pieces could be merged and deployed one at a
-- time. Every piece on its switch-on checklist (US43_test_cases.md) is now deployed: US49's 0110
-- (cancelling a rejected booking), US44's decision (0111), US26's confirm-when-ready (0117) and
-- US45's revise and send-back (0118). From here an event is confirmed only after its safety
-- review: Planning -> Awaiting Safety Review -> In Preparation -> Confirmed.
-- The setting stays as the single switch, so it can be turned off again by updating it.
-- Safe to replay.
begin;

update public.safety_review_settings set enabled = true, updated_at = now() where not enabled;

commit;
