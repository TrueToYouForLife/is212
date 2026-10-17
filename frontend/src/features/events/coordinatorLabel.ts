/**
 * PURE MODULE — no React, no Supabase, no I/O.
 *
 * What a request card says about who coordinates the event. "Assigned to you" told a Coordinator
 * nothing about the other events, so every card now names the Coordinator.
 *
 * coordinatorId follows the rule in EventRequestSummary: undefined means the list did not load it,
 * and only an explicit null means nobody is assigned.
 */
export function describeCoordinator(
  coordinatorId: string | null | undefined,
  coordinatorName: string | undefined,
  viewerId: string | undefined,
): string | null {
  if (coordinatorId === undefined) return null
  if (coordinatorId === null) return 'No coordinator assigned'
  // The name can be missing without anything being wrong: the lookup failed, or was not allowed.
  // Say that someone is assigned rather than guess who.
  if (!coordinatorName) return coordinatorId === viewerId ? 'You' : 'Coordinator assigned'
  return coordinatorId === viewerId ? `${coordinatorName} (you)` : coordinatorName
}
