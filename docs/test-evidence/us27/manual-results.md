# US27 reported manual results

Tester: Jaydon. Report date: 23 October 2026.

Source: Jaydon confirmed the PR1 chat groups worked, then confirmed status-flow checks
and the subsequent automatic-close refinement passed. These are reported results,
not a separate execution by another tester. Exact fixture/account IDs and individual
execution timestamps were not supplied. No manual product defect was reported.

| Role | Reported scope | Result |
|---|---|---|
| Technical Support | Catalogue unit details/current location/status and total/usable counts | Pass |
| Technical Support | Combined filters, reset and refresh; no catalogue add/delete controls | Pass |
| Coordinator | Read-only catalogue access; no status-management controls | Pass |
| Organiser / Attendee | Catalogue access refused; existing equipment workflows retained for their original roles | Pass |
| Technical Support | Status change with reason, refreshed stock/counts and recorded history | Pass |
| Technical Support | Blank reason refused | Pass |
| Technical Support, two tabs | Stale edit refused, note retained, explicit reload before retry | Pass |
| Technical Support / assigned Coordinator | Non-operational reserved unit produces affected-arrangement review/notice while retaining the reservation | Pass |
| Technical Support | Confirmed save closes management; another unit can be managed without manually closing the previous panel | Pass |

Offline/uncertain-response handling, zero-stock-specific fixtures, every notification
preference combination and each optional broader checklist scenario were not separately
confirmed manually. Automated cases cover these relevant failure/boundary rules.
Email queuing does not establish delivery; delivered email is not claimed. No separate
shared frontend deployment timestamp/operator was supplied.

Migrations 0104 and 0105 were confirmed applied by Jaydon. Implementation PRs #142,
#143 and #144 are merged. Shared evidence-sheet update and Jira transition are not
claimed complete. Sheet rows are supplied in chat, never as repository TSV files.
