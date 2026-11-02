# Test-case documentation index

Checked: 2 November 2026. Source baseline: `557ad94` (current main when this branch
was created). Test-case catalogues belong in `docs/test-cases/`; implementation/AC
notes remain in `docs/`, and execution/failure evidence stays in `docs/test-evidence/`.

## Current source traceability

All **2,880 distinct numeric AC test-ID references across 45 stories** in the tracked
frontend test files and `backend/supabase/tests/` are represented in their story's
catalogue below. This checks source-to-document traceability, not pass rates, runtime
case counts, coverage percentages or completeness against a newer Jira backlog.
Parameterized tests and grouped SQL assertions can execute several checks for one ID.

The source scan includes `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` and database
`.sql`/`.sh` test sources. It excludes evidence logs, migrations, README ID-allocation
notes and application comments from the test inventory. Multiple references to the
same ID count once; linked source locations preserve cross-story coverage.

| Story | Unique source IDs | Catalogue | Documentation status |
| --- | ---: | --- | --- |
| US1 | 83 | [US1 test cases](US1_test_cases.md) | All source IDs listed |
| US2 | 61 | [US2 test cases](US2_test_cases.md) | All source IDs listed |
| US3 | 14 | [US3 test cases](US3_test_cases.md) | All source IDs listed |
| US4 | 69 | [US4 test cases](US4_test_cases.md) | All source IDs listed |
| US5 | 25 | [US5 test cases](US5_test_cases.md) | All source IDs listed |
| US6 | 78 | [US6 test cases](US6_test_cases.md) | All source IDs listed |
| US7 | 266 | [US7 test cases](US7_test_cases.md) | All source IDs listed |
| US8 | 34 | [US8 test cases](US8_test_cases.md) | All source IDs listed |
| US9 | 93 | [US9 test cases](US9_test_cases.md) | All source IDs listed |
| US10 | 191 | [US10 test cases](US10_test_cases.md) | All source IDs listed |
| US11 | 15 | [US11 test cases](US11_test_cases.md) | All source IDs listed |
| US12 | 143 | [US12 test cases](US12_test_cases.md) | All source IDs listed |
| US13 | 113 | [US13 test cases](US13_test_cases.md) | All source IDs listed |
| US14 | 104 | [US14 test cases](US14_test_cases.md) | All source IDs listed |
| US15 | 74 | [US15 test cases](US15_test_cases.md) | All source IDs listed |
| US16 | 123 | [US16 test cases](US16_test_cases.md) | All source IDs listed |
| US17 | 53 | [US17 test cases](US17_test_cases.md) | All source IDs listed |
| US18 | 93 | [US18 test cases](US18_test_cases.md) | All source IDs listed |
| US19 | 41 | [US19 test cases](US19_test_cases.md) | All source IDs listed |
| US20 | 79 | [US20 test cases](US20_test_cases.md) | All source IDs listed |
| US21 | 19 | [US21 test cases](US21_test_cases.md) | All source IDs listed |
| US22 | 34 | [US22 test cases](US22_test_cases.md) | All source IDs listed |
| US23 | 34 | [US23 test cases](US23_test_cases.md) | All source IDs listed |
| US24 | 37 | [US24 test cases](US24_test_cases.md) | All source IDs listed |
| US26 | 9 | [US26 test cases](US26_test_cases.md) | All source IDs listed |
| US27 | 40 | [US27 test cases](US27_test_cases.md) | All source IDs listed |
| US29 | 40 | [US29 test cases](US29_test_cases.md) | All source IDs listed |
| US31 | 60 | [US31 test cases](US31_test_cases.md) | All source IDs listed |
| US32 | 60 | [US32 test cases](US32_test_cases.md) | All source IDs listed |
| US33 | 57 | [US33 test cases](US33_test_cases.md) | All source IDs listed |
| US34 | 35 | [US34 test cases](US34_test_cases.md) | All source IDs listed |
| US36 | 5 | [US36 test cases](US36_test_cases.md) | All source IDs listed |
| US37 | 111 | [US37 test cases](US37_test_cases.md) | All source IDs listed |
| US38 | 57 | [US38 test cases](US38_test_cases.md) | All source IDs listed |
| US41 | 21 | [US41 test cases](US41_test_cases.md) | All source IDs listed |
| US42 | 19 | [US42 test cases](US42_test_cases.md) | All source IDs listed |
| US43 | 48 | [US43 test cases](US43_test_cases.md) | All source IDs listed |
| US44 | 25 | [US44 test cases](US44_test_cases.md) | All source IDs listed |
| US45 | 13 | [US45 test cases](US45_test_cases.md) | All source IDs listed |
| US46 | 130 | [US46 test cases](US46_test_cases.md) | All source IDs listed |
| US47 | 61 | [US47 test cases](US47_test_cases.md) | All source IDs listed |
| US48 | 49 | [US48 test cases](US48_test_cases.md) | All source IDs listed |
| US49 | 68 | [US49 test cases](US49_test_cases.md) | All source IDs listed |
| US52 | 41 | [US52 test cases](US52_test_cases.md) | All source IDs listed |
| US54 | 55 | [US54 test cases](US54_test_cases.md) | All source IDs listed |

Shared/untagged tests: [authentication and lifecycle catalogue](Shared_test_cases.md).
This lists the existing titles and parameter cases without allocating new AC IDs.

## Known distinctions and follow-ups

- **US41:** `AC-041.1.3` is a documented intention with no matching test-source ID.
  Replay snapshots exist, but their comparison is missing. It is explicitly excluded
  from the implemented-case inventory and retained as the next verification portion.
- **US48:** 49 source IDs include the historical `AC-048.2.6` venue-block UI case.
  The US48 catalogue explains that it is dependency coverage, not an additional
  replacement-search AC case. There are 48 replacement cases across the original flow
  and safety-stage follow-up; do not relabel the historical source ID.
- **Manual checks:** existing Not run, deferred and unreported outcomes remain as
  recorded. A catalogue entry or an automated pass cannot establish a manual pass.
  US48's new-stage manual checks still need an actual report; earlier manual evidence
  applies only to its recorded scope. Existing evidence-sheet entries are unchanged.
- **No numeric test IDs found:** US25, US28, US30, US35, US39, US40, US50, US51 and US53.
  This means this checkout has no matching IDs in the scanned sources. It does not
  establish that those stories are unimplemented or untested under another story;
  owners should confirm their intended AC/test mapping before submission.
- **Historical vocabulary:** some sources intentionally retain legacy AM/PM/Night,
  old hold limits, old notification defaults or earlier lifecycle fixtures. Their
  catalogues describe those tests without reinstating superseded product rules.

## Documentation verification for this change

- Every current numeric source ID appears in its own canonical Markdown catalogue.
- Every source AC prefix appears there; this is not a claim about absent Jira ACs.
- New catalogue source links and line anchors resolve to files containing those IDs.
- US45's existing document was moved from `docs/` to `docs/test-cases/`, matching the
  README's existing reference; its design/manual/evidence records are retained.
- Rendering tests previously labelled unit in existing compact tables are classified
  as component; pure/service unit and SQL integration cases retain their distinction.
- Application, migration and test sources are unchanged. No new automated test run,
  manual result, deployment, defect or delivered email is claimed by this PR.
