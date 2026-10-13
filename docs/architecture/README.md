# ConnectSphere architecture and workflow

Updated 13 October 2026. Owner: Jaydon.

Open `index.html` in a browser to view the six diagrams. Each SVG is an editable vector file, so text remains sharp when enlarged. Edit the shapes/text in an SVG editor, or update `generate.py` and run `python3 docs/architecture/generate.py` from the repository root. Regeneration overwrites the six SVGs, so keep edits in the generator when using that workflow.

- `c1-context.svg`: seven user roles, ConnectSphere, and external email delivery.
- `c2-containers.svg`: browser application, Supabase Auth, Data API, database, email sender, and planned scheduling.
- `c3-components.svg`: logical components inside the React application; backend rules remain outside that container.
- `workflow-part-1.svg`: request, assignment and review, including clarification, rejection and withdrawal.
- `workflow-part-2.svg`: venue/equipment planning, readiness, safety review and revisions.
- `workflow-part-3.svg`: confirmation, registration, preparation, delivery, completion and equipment returns.

## Scope and sources

These diagrams describe the whole-project target architecture, including capabilities not yet implemented. They are not a Jira completion report. They preserve the earlier diagrams' request/review, change-request, venue, equipment, authentication, shared UI and registration responsibilities while incorporating the changed requirements.

Sources reviewed:

- Week 1 Customer Briefing (1).docx: overall business scope and lifecycle.
- Week 4 Project Instructions.docx: release scope and whole-project modelling expectations.
- Week 7 Customer Changes.pdf and Week 7 Guide to Managing Changes.pdf.
- Jira (8).csv, particularly US26, US41, US43–45, US47–49.
- The supplied instructor clarification: booking granularity changes from three daily slots to 15 minutes.
- Repository snapshot `974ad79`, including frontend feature services and the Supabase notification sender. Current code is evidence of implementation structure, not a substitute for future requirements.

## Important modelling decisions

- Event Coordinator Lead replaces the old Events Operations Manager title. Legacy role strings in the database are not additional planned actors.
- Safety Officer is a separate role. Jira US43 prevents confirmation/preparation while awaiting safety review; US44 approval moves to In Preparation. The workflow follows this backlog ordering, with coordinator confirmation after safety approval and readiness. Week 7 itself specifies the pre-preparation safety gate.
- Venue booking windows include configurable setup and turnaround. The target uses 15-minute granularity; any existing three-slot implementation is not the target requirement.
- Multiple venue bookings are independently checked and retained. A venue problem does not automatically cancel the event or its other bookings.
- Approved significant changes trigger checks and flags, not automatic cancellation. US7's revalidation hook alone does not mean US41 is implemented.
- The notification sender exists in code. Its live invocation, delivery deployment, shared notification UI and scheduling are not verified by these diagrams. C2 shows the scheduler as planned with its mechanism undecided.
- C3 groups logical responsibilities, not new deployable services or a proposed folder restructuring. Feature services call the shared Supabase client; pure validators perform no I/O. Shared UI supports the feature components. C3 uses feature modules, consistent with the original diagram. Each module includes UI, services and pure validation. Labelled dashed arrows describe workflow/information relationships (through persisted records and backend operations), not direct JavaScript calls. Solid arrows describe technical dependencies on Auth, Shared UI and the Supabase Client. Shared dependencies attach to the feature-module group; these lines are drawing conventions, not runtime buses. Planned revalidation and safety components are not claims of existing implementation.
- C1 connects email delivery directly to the six evidenced recipient roles with dashed brown arrows routed around the perimeter. Shared line segments are a drawing convention, not an additional component. Actual delivery depends on the notification type and user preferences. Coordinator Lead has no email arrow because no specific recipient requirement was identified in the supplied backlog.

## Verification

Documentation only: no application code, database migrations or deployment settings changed. The SVGs were parsed as XML, rasterised and visually inspected. The viewer could not be opened in the in-app browser because local file URLs are blocked; open index.html in your own browser. No claims are made about new feature test results or live Supabase configuration.

## C1 email recipient evidence

The target includes both notification channels under clarification #37, with per-type preferences in US33 (AC-033.1–4). This supports email for named notification recipients; it does not imply every system role receives every notification.

- Organiser: explicit email outcome in AC-004.4; assignment notices in AC-017.5.
- Attendee: explicit registration email in AC-015.3; waiting-list and event-change notices in US16/US21.
- Coordinator: change-request notices in AC-007.1 and assignment notices in AC-017.5, combined with #37/US33. Current SQL also queues coordinator email.
- Venue Staff: new booking notices in AC-009.8, combined with #37/US33.
- Technical Support Staff: added/changed equipment requirements in AC-013.4, combined with #37/US33.
- Safety Officer: awaiting-review notices in AC-043.2, combined with #37/US33.
- Coordinator Lead: no specific notification recipient requirement identified; omitted from email delivery links. The Lead still uses ConnectSphere.

Only the Organiser and Attendee ACs above explicitly name email themselves. The other four links express the planned combination of role-specific notifications and the shared channel requirement, not verified live email implementation.

## Workflow presentation

The three retained workflow diagrams are Workflow Part 1, Part 2 and Part 3. The viewer opens Part 1 by default. Continuation A connects request approval to planning in Part 2; B connects safety approval to confirmation in Part 3. Roles and arrow descriptions identify responsibilities and outcomes.

These show the main business journey and key revision loops, not every acceptance-criterion edge case. Notifications, permissions and history apply throughout. Expired holds free availability; resource problems and significant changes require rechecking affected arrangements. Equipment return is a separate follow-up, not an additional completion prerequisite.

`generate.py` generates only C1, C2, C3 and these three workflow SVGs. The superseded combined workflow, exception diagram and Mermaid versions have been removed. No application code or database changes are involved.
