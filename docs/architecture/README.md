# ConnectSphere architecture and workflow

Prepared: **6 November 2026**. Owner: **Jaydon**.

The current C1–C3 replace the earlier architecture diagrams in this folder.
The three workflow SVGs are retained unchanged. No application, test, migration
or deployment setting is changed.

## Open and use

Open [index.html](index.html) in a browser to view all three. Open an individual
SVG for sharp zooming; use the PNG version for slides or Google Docs.

| Diagram | Editable vector | Slide/document image | Scope |
|---|---|---|---|
| C1 | [c1-context.svg](c1-context.svg) | [c1-context.png](c1-context.png) | People, ConnectSphere and the external email provider |
| C2 | [c2-containers.svg](c2-containers.svg) | [c2-containers.png](c2-containers.png) | Runtime containers, protocols, trust boundaries and conditional jobs |
| C3 | [c3-components.svg](c3-components.svg) | [c3-components.png](c3-components.png) | Logical components inside the React browser container |

Blue is implemented architecture in the inspected source, green is people, grey is
an external system/container reference, and amber denotes conditional
scheduled SQL. Broader future scope is retained in the table below. Shapes express architecture, not a claim that
all acceptance criteria, manual checks or deployment checks passed.

The C3 groups are cohesive logical responsibilities, not twelve separately deployed
services or a proposed folder restructure. Multiple groups share `features/events`.
Features use shared presentation/session support and the Supabase client; their
business relationships are mediated through persisted data and backend operations.
Database rules are in the PostgreSQL container shown in C2, not in React validators.

### Revised C2/C3 format and arrows

C1 retains its approved layout. C2 and C3 use the established
architecture diagrams' white background, centred module boxes, dashed boundaries
and overall arrangement. Their text remains updated for the current requirements.
C2 keeps the earlier two-column layout. Its jobs box is explicitly inside the
PostgreSQL runtime rather than an additional deployed server.

C3 uses the earlier twelve-module decomposition. Venue discovery, buffers, multiple
bookings, disruption and replacement are grouped in Venue Booking Module; equipment
catalogue, reservations, condition and inspections are grouped in Equipment Booking
Module. Audit display is in Event Lifecycle Module. These responsibilities remain
in the source mapping below; regrouping does not add/remove a product capability.

- Dashed brown arrows: labelled workflow/information relationships through persisted
  records and checked backend operations. They are **not JavaScript import/call arrows**.
- Solid slate arrows: technical dependencies on authentication context, shared UI and
  the Supabase client, plus its external Auth/Data API calls.
- Arrows attach to the feature-group boundary for shared dependencies that apply to
  all modules. Crossings without a junction are not connections.
- Backend notifications arise from all applicable request, assignment, change,
  booking, equipment, safety and lifecycle producers. The registration-to-notification
  arrow is one example; the diagram's footnote makes the wider scope explicit.

The seventeen labelled feature relationships are retained in
[interaction-map.json](interaction-map.json) for checking:

| Source | Destination | Relationship |
|---|---|---|
| Event Request | Change Request | Request to amend |
| Change Request | Change Review | Proposed values and clarification replies |
| Change Review | Change Request | Field questions and outcomes |
| Event Request | Assignment | Submitted, unassigned requests |
| Assignment | Event Review | Assigned requests |
| Change Review | Revalidation | Approved significant changes |
| Event Review | Equipment Booking | Equipment requirements |
| Event Review | Venue Booking | Approved event and venue needs |
| Revalidation | Venue Booking | Venue flags/reasons for corrective action |
| Revalidation | Equipment Booking | Equipment flags/reasons for corrective action |
| Venue Booking | Readiness & Safety | Venue decisions, capacity and restrictions |
| Equipment Booking | Readiness & Safety | Reservation readiness |
| Readiness & Safety | Event Lifecycle | Safety approval or outstanding actions |
| Event Lifecycle | Venue Booking | Revised venue arrangements |
| Event Lifecycle | Equipment Booking | Revised equipment arrangements |
| Event Lifecycle | Registration | Confirmed events eligible for registration |
| Registration | Notification | Registration and waiting-list outcomes |

Revalidation also responds to resource changes and rescheduling, as its module label
states. All such updates use the database; the arrows are a readable overview of
primary relationships, not an exhaustive call graph.

## Source baseline and limits

- Inspected checkout: `a260e93` (`us48-replacement-coverage`), which contains the
  earlier merged features and the latest local US48 coverage portion. This is an
  architecture source baseline, **not a claim that it is the final main release SHA**.
- Week 1 Customer Briefing (1).docx: full product responsibilities and broader scope.
- Week 4 Project Instructions.docx: 20 Release 1 core capabilities and C4 expectations.
- Week 7 Customer Changes.pdf: all six changes, including the requirement to notify
  Coordinators about expiring holds. The Managing Changes guide informed the
  distinction between new requirements and implementation status.
- `Jira (14).csv`: story names/requirements only, not current status or ownership.
- Current repository migrations through 0123, application routes, feature services,
  notification worker, story notes and acceptance-case documentation.
- Telegram export through 6 November 2026 17:17: the agreed review flow and reported
  hold-expiry notification gap. Messages are context, not new architecture instructions.
- The older architecture and supplied discussion-summary document were consulted;
  the older architecture's planned checkpoints are not treated as current completion.

No shared database, email inbox, scheduler configuration or final release checkout
was tested for this documentation task. Compare any later release changes against
this baseline before calling these diagrams a verified description of that release.

## Week 4 core requirements — all 20 mapped

The C numbers follow the team's release coverage map. This is architectural
traceability; the separate testing and acceptance records determine pass/fail.

| Core | Requirement | Relevant stories | Architecture responsibility |
|---|---|---|---|
| C1 | Authentication and authorisation | US17, US29, US31; shared access rules | C1 roles; C2 Auth/API/RLS; C3 identity context and organisation access |
| C2 | Event request creation | US2 | Requests and initial review |
| C3 | Draft event requests | US1 | Requests and initial review |
| C4 | Event review and clarification | US4, US37 | Requests and initial review |
| C5 | Coordinator assignment | US17, US36 | Coordinator assignment |
| C6 | Event status management | US3, US21, US22, US26, US38 | Request status; lifecycle; readiness/safety |
| C7 | Event information management | US20, US34, US41, US42 | Lifecycle/visibility; independent reviews; audit display |
| C8 | Venue catalogue | US46 | Venue discovery and catalogue |
| C9 | Venue availability calendar | US19 | Venue discovery; API/database occupancy rules |
| C10 | Venue search and filtering | US8 | Venue discovery and catalogue |
| C11 | Venue suitability checking | US18 | Venue discovery and catalogue; database checks |
| C12 | Venue booking request | US9, US11 | Venue holds and bookings |
| C13 | Venue booking approval | US10 | Venue holds and bookings; checked database decisions |
| C14 | Booking conflict detection | US9, US10, US47 | Venue holds/bookings; PostgreSQL claims and constraints |
| C15 | Equipment request management | US13 | Equipment requests and stock |
| C16 | Equipment reservation | US14 | Equipment requests and stock; allocation rules |
| C17 | Equipment availability/status | US24, US27 | Equipment stock, condition and return inspections |
| C18 | Attendee registration | US15, US16, US23, US52, US54 | Registration and waiting list |
| C19 | Event change requests | US6, US7, US41 | Changes and arrangement reviews |
| C20 | Notifications | US32, US33 and event-specific producers | Notifications/preferences; database outbox; email worker |

## Week 7 changes — all six represented

| Change | Requirement | Where represented / exact qualification |
|---|---|---|
| W7-1 | Per-venue setup and turnaround; identify affected bookings | C1 Venue Staff; C3 booking/reviews; 0074, 0075, 0098. Independent non-negative multiples of 15; zero means none. Saved occupancy and newly required buffers participate in conflicts; existing reservations are preserved and flagged. |
| W7-2 | Venue unavailable after booking; keep event; replacement | C3 disruption/replacement; 0099, 0100, 0116. Continuous block interval, retirement reasons, prefilled affected-booking requirements, normal staff approval. Original releases only after successful atomic replacement; only matching open blocked/retired reviews resolve with actual staff and replacement link. Other reviews and sibling bookings remain. |
| W7-3 | Multiple venues per event | C3 booking component; 0102, 0107, 0110. Independent layout/attendance and conflicts per booking, legacy event defaults, separate cancellation; sibling arrangements remain. |
| W7-4 | Expiring tentative holds and Coordinator notification | C3 holds; timestamp-based expiry frees availability and expired holds cannot be approved. **Expiry notification is reported unimplemented** in the 6 November discussion. The diagram does not invent a scheduled notifier or claim this requirement is complete. |
| W7-5 | Coordinator Lead, unassigned queue, scoped management, notices | C1 Lead; C3 assignment and notifications; 0038–0041, 0047–0048 and later overrides. Lead sees active assignments/workload; assigned-only operations and handover are server-enforced. |
| W7-6 | Operational safety gate, decisions and revisions | C1 Safety Officer; C3 readiness/safety; 0108, 0109, 0111, 0117, 0118, 0123. Coordinator explicitly sends once ready. Officer approval precedes In Preparation, then Coordinator confirmation. Requested/significant changes require relevant revision/review. |

Safety is enabled by migration 0123 in the inspected source. The historical frontend
feature flag has been removed. The database setting remains. Registration setup does
not block sending for safety review because registration opens after confirmation.

## Broader Week 1 requirements

Week 4 explicitly limits Release 1 to its core scope while allowing broader features
in the backlog/C4 model. The table below retains the broader product scope without presenting missing
features as completed components in the diagrams:

| Broader capability | Existing responsibility / future extension |
|---|---|
| Programmes and multi-session planning | Basic programme content belongs to lifecycle/planning. Rich independently scheduled sessions remain future scope. |
| Reusing recurring/similar events | Future extension of request creation and lifecycle; no implemented clone/recur workflow is asserted. |
| Comments, discussion and supporting documents | Request/change clarification is implemented; general discussion and attachment management remain future extensions. No storage deployment is invented. |
| Technical support needs and staff allocation | Needs/review/readiness are represented in equipment/planning. Dedicated on-site staff rostering remains future scope. |
| Attendance versus registration | Registration and waiting-list records exist; attendance/check-in is a separate future capability. |
| Reminders and event calendars | Venue calendar, waiting-offer expiry and event completion are represented. A general event-calendar/reminder service is not claimed implemented. |
| Reports and export | Existing status, arrangement and registration views are represented; general event/venue reports and exports remain future extensions. |

No payment, attendee check-in, physical equipment checkout, file-storage container or
separate custom API server is introduced to fill these future requirements.

## Code traceability

Paths below are relative to the repository root. They identify implementation
responsibilities, not a requirement to split existing files.

| Diagram responsibility | Source evidence |
|---|---|
| Application shell/session | `frontend/src/App.tsx`, `frontend/src/features/auth/SessionProvider.tsx`, `frontend/src/components/layout/TopNav.tsx` |
| Shared client | `frontend/src/lib/supabase.ts` |
| Requests/review | `frontend/src/features/events/eventDraftService.ts`, request/review pages, `ReviewActions.tsx`, clarification components |
| Assignment | `frontend/src/features/events/coordinatorAssignmentService.ts`, `components/CoordinatorAssignmentQueue.tsx`, `components/CoordinatorAssignmentForm.tsx` |
| Change review/revalidation display | `frontend/src/features/events/changeRequestReviewService.ts`, `arrangementReviewService.ts`, respective panels |
| Venue discovery | `frontend/src/features/venues/venueSearchService.ts`, `suitabilityService.ts`, availability and management pages |
| Holds/bookings/buffers | `frontend/src/features/venues/holdRules.ts`, `venueBookingService.ts`, `venueBufferSettingsService.ts`; 0075, 0098, 0102 |
| Disruption/replacement | `frontend/src/features/venues/venueBlockService.ts`, `venueReplacementService.ts`, `components/ReplacementVenueSearch.tsx`; 0099, 0100, 0116 |
| Equipment | `frontend/src/features/equipment/` catalogue, reservation, status and return services; 0104, 0105, 0112 |
| Readiness/safety | `frontend/src/features/events/` readiness components, `frontend/src/features/safety/`; 0108, 0111, 0117, 0118, 0123 |
| Lifecycle/organisation visibility | `frontend/src/features/events/` lifecycle, organisation and confirmed-arrangement services; 0069, 0071, 0078, 0119, 0121, 0122 |
| Registration/waiting list | `frontend/src/features/registrations/`, `frontend/src/features/events/pages/EventRegistrationsPage.tsx`; 0058, 0060, 0062, 0094 |
| In-app notifications/preferences | `frontend/src/features/notifications/`, notification producers and US33 helpers in SQL |
| Audit | `frontend/src/features/events/` audit display; `backend/supabase/migrations/0101_event_audit_log.sql` triggers |
| Email worker | `backend/supabase/functions/send-review-notifications/index.ts` |
| Conditional SQL jobs | `backend/supabase/migrations/0062_waitlist_expiry_job.sql`, `0119_us38_status_lifecycle.sql` |

## Runtime and business-rule qualifications

- **Security:** public/publishable browser key plus user session; role/organisation/
  assignment rules are enforced through RLS, grants and checked functions. UI hiding
  is not a substitute. SECURITY DEFINER operations perform explicit checks.
- **Email:** worker uses a privileged supabase-js client through the Data API to
  claim/update `notification_outbox`, then SMTP/TLS to Gmail. Outbox presence does
  not prove delivery. Invocation, secrets and provider availability are deployment
  conditions, not a verified assertion here.
- **Scheduling:** 0062 schedules waiting-offer expiry once per minute and 0119 schedules
  overdue completion hourly only if `pg_cron` exists. No extra scheduler application
  is depicted. The diagrams do not establish that those jobs are enabled live.
- **Equipment returns:** Out includes the saved collection-to-return dates; Pending
  checks starts the following Singapore day. No physical checkout/return timestamp
  or storage-location movement is invented. Missing inspections remain pending.
- **Review resolution:** recording a resolution does not move a reservation. Resource
  corrections and recorded explanations are separate operations. Replacement approval
  has the narrower atomic blocked/retired-review resolution contract described above.
- **Lifecycle:** postponement retains arrangements; rescheduling flags them for review;
  event cancellation releases resources under the checked workflow. These are not
  interchangeable operations.
- **Audit:** database-triggered audit writes and authenticated actor attribution are
  represented as backend responsibilities. The browser displays the record.
- **Legacy roles:** `operations_manager` remains in some compatibility paths. It is
  not drawn as an eighth business actor because Coordinator Lead is the required role.

## Regeneration and checks

Run `python3 docs/architecture/generate_architecture.py` from the repository root to
regenerate only C1–C3 and their component/interaction maps. The existing
`python3 docs/architecture/generate.py` entry point generates these current C1–C3
and the three retained workflows; it no longer contains the superseded architecture.
PNGs are exports
of those SVGs, not separate editable originals. Re-export PNGs after editing SVGs.

Checks for this documentation task:

- Generated SVGs parsed as XML and rendered to PNG for visual inspection.
- Text and diagram edges reviewed at rendered size; layout corrections applied.
- All 20 core rows and all six Week 7 changes mapped above.
- The three workflow SVGs are preserved byte-for-byte during architecture consolidation.
- No application/SQL/test change and no new runtime test/manual/deployment pass claimed.

## Presentation cleanup

The exported diagrams and viewer contain no preparation dates, owner names,
subtitles, release commentary, story-number annotations or provenance footers.
Titles, architectural content, interaction arrows and legends remain. Sources,
future scope and deployment qualifications remain documented here.

## Retained workflow diagrams

The viewer also provides [Workflow Part 1](workflow-part-1.svg),
[Workflow Part 2](workflow-part-2.svg) and [Workflow Part 3](workflow-part-3.svg).
These are the retained 13 October workflow documents, unchanged by the C1–C3 update.
Their historical target-state wording is not a new release verification claim.

SVGs and PNGs use the same stable names: `c1-context`, `c2-containers` and
`c3-components`. The original Git history retains the preceding architecture versions.
