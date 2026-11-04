# Shared authentication and lifecycle tests

Catalogue checked: 2 November 2026. These existing tests have either legacy tags or no
story ID. They stay documented by their actual source name/location rather than being
assigned invented Jira AC IDs. This is a source inventory, not a new run/pass record.
The legacy prefixes remain unchanged in code; story allocation is an owner follow-up.

## Legacy tags

| Existing test title / parameter case | Classification | Test source |
| --- | --- | --- |
| AC-ROLES.1-01: recognises an assigned operations manager profile | Unit — Happy path | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L62) |
| AC-LIFECYCLE.5-approved-planning: persists the coordinator transition | Unit — Happy path | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L327) |
| AC-LIFECYCLE.5-planning-confirmed: persists the coordinator transition | Unit — Happy path | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L327) |
| AC-LIFECYCLE.5-confirmed-completed: persists the coordinator transition | Unit — Happy path | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L327) |
| AC-LIFECYCLE.5-approved-cancelled: persists the coordinator transition | Unit — Happy path | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L327) |
| AC-LIFECYCLE.2-01: manager lifecycle writes are denied before persistence | Unit — Negative | [frontend/src/features/events/__tests__/eventReviewService.test.ts](../../frontend/src/features/events/__tests__/eventReviewService.test.ts#L338) |
| AC-LIFECYCLE.1-approved: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-planning: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-awaiting_safety_review: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-safety_changes_requested: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-in_preparation: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-confirmed: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-postponed: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-completed: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-cancelled: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.1-draft: offers the permitted next steps | Unit — Happy path | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L100) |
| AC-LIFECYCLE.2-operations_manager: cannot change lifecycle even if they own a historical request | Unit — Negative | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L114) |
| AC-LIFECYCLE.2-venue_staff: cannot change lifecycle even if they own a historical request | Unit — Negative | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L114) |
| AC-LIFECYCLE.2-tech_support: cannot change lifecycle even if they own a historical request | Unit — Negative | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L114) |
| AC-LIFECYCLE.2-attendee: cannot change lifecycle even if they own a historical request | Unit — Negative | [frontend/src/features/events/__tests__/statusRules.test.ts](../../frontend/src/features/events/__tests__/statusRules.test.ts#L114) |
| AC-LIFECYCLE.3-approved: invokes the guarded service and refreshes after success | Component — Happy path | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L68) |
| AC-LIFECYCLE.3-planning: invokes the guarded service and refreshes after success | Component — Happy path | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L68) |
| AC-LIFECYCLE.3-confirmed: invokes the guarded service and refreshes after success | Component — Happy path | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L68) |
| AC-LIFECYCLE.4-01: cancellation requires confirmation | Component — Happy path | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L84) |
| AC-LIFECYCLE.4-02: a failed update reports an error and allows retry | Component — Negative | [frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx](../../frontend/src/features/events/status/__tests__/RequestStatusPanel.test.tsx#L97) |

## Tests without a story tag

| Existing test title | Classification | Test source |
| --- | --- | --- |
| goes where the user was headed once signed in | Component — Happy path | [frontend/src/features/auth/__tests__/SignInPage.test.tsx](../../frontend/src/features/auth/__tests__/SignInPage.test.tsx#L56) |
| stays on the sign-in page and says why when the credentials are refused | Component — Negative | [frontend/src/features/auth/__tests__/SignInPage.test.tsx](../../frontend/src/features/auth/__tests__/SignInPage.test.tsx#L65) |
| recognises the supported application role vocabulary | Unit — Happy path | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L25) |
| every role has a human-readable label | Unit — Happy path | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L39) |
| rejects a value that is not one of the known roles | Unit — Negative | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L45) |
| returns the profile with its role for the signed-in user | Unit — Happy path | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L54) |
| returns null for an unrecognised role rather than defaulting to organiser | Unit — Negative | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L67) |
| returns null when the profile row does not exist yet | Unit — Negative | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L75) |
| returns null when the lookup is refused | Unit — Negative | [frontend/src/features/auth/__tests__/roles.test.ts](../../frontend/src/features/auth/__tests__/roles.test.ts#L81) |
| accepts a well-formed email and password | Unit — Happy path | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L13) |
| trims surrounding whitespace from the email | Unit — Happy path | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L22) |
| rejects a missing email | Unit — Negative | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L35) |
| rejects an email without an @ | Unit — Negative | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L43) |
| rejects a missing password | Unit — Negative | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L51) |
| rejects a 5 character password (boundary, invalid) | Unit — Negative | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L59) |
| accepts a 6 character password (boundary, valid) | Unit — Boundary | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L67) |
| reports both fields at once rather than one at a time | Unit — Happy path | [frontend/src/features/auth/__tests__/validation.test.ts](../../frontend/src/features/auth/__tests__/validation.test.ts#L75) |
| saved booking summary groups adjacent quarters but preserves gaps, roles and dates | Component — Happy path | [frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingComponents.test.tsx#L82) |
| staff review summarises consecutive booking slots while retaining buffers and conflict details | Component — Happy path | [frontend/src/features/venues/__tests__/VenueBookingConflicts.test.tsx](../../frontend/src/features/venues/__tests__/VenueBookingConflicts.test.tsx#L37) |


## Coverage follow-up ? 4 November 2026

Shared authentication/session and date-formatting regressions are listed by their existing names. They have no established story AC mapping; numeric story IDs have not been invented. Parameter cases are listed explicitly.

| Existing test title / parameter case | Classification | Test source |
| --- | --- | --- |
| loading hides sign-in and stale account details | Component ? Regression | [SessionBadge.test.tsx](../../frontend/src/features/auth/__tests__/SessionBadge.test.tsx) |
| signed-out users have a sign-in link | Component ? Regression | [SessionBadge.test.tsx](../../frontend/src/features/auth/__tests__/SessionBadge.test.tsx) |
| signed-in users see their email and role and can sign out | Component ? Regression | [SessionBadge.test.tsx](../../frontend/src/features/auth/__tests__/SessionBadge.test.tsx) |
| a session without email or profile remains signed in without inventing a role | Component ? Regression | [SessionBadge.test.tsx](../../frontend/src/features/auth/__tests__/SessionBadge.test.tsx) |
| invalid fields display validation errors without sending credentials | Component ? Regression | [SignInPage.test.tsx](../../frontend/src/features/auth/__tests__/SignInPage.test.tsx) |
| an existing session redirects to the originally requested page | Component ? Regression | [SignInPage.test.tsx](../../frontend/src/features/auth/__tests__/SignInPage.test.tsx) |
| does not redirect while the existing session is being checked | Component ? Regression | [SignInPage.test.tsx](../../frontend/src/features/auth/__tests__/SignInPage.test.tsx) |
| session listener reports sign-in, missing email and sign-out, and unsubscribes | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| sign-out waits for the authentication service | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| session lookup: no session | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| session lookup: email present | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| session lookup: email absent | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| sign-in: successful | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| sign-in: credentials error | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| sign-in: blank error uses fallback | Unit ? Regression | [authSessionService.test.ts](../../frontend/src/features/auth/__tests__/authSessionService.test.ts) |
| returns the provider session including its refresh operation | Component ? Regression | [sessionContext.test.tsx](../../frontend/src/features/auth/__tests__/sessionContext.test.tsx) |
| reports a missing provider instead of inventing a signed-out session | Component ? Regression | [sessionContext.test.tsx](../../frontend/src/features/auth/__tests__/sessionContext.test.tsx) |
| date format: 2041-03-10 | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
| date format: 2041-01-01 | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
| date format: 2041-12-31 | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
| date format: invalid text preserved | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
| date format: month 00 preserved | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
| date format: month 13 preserved | Unit ? Regression | [slotFormat.test.ts](../../frontend/src/features/venues/__tests__/slotFormat.test.ts) |
