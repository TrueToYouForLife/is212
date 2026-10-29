/**
 * One record of the event audit trail (US34, 0101's get_event_audit_log). `action` is an open
 * string on purpose: later stories (the safety review) add actions in the database, and the
 * view still shows them without a change here.
 */
export interface AuditEntry {
  id: string
  action: string
  itemType: string
  itemId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  occurredAt: string
  actorId: string | null
  /** Null when the change was made by the system or an administrator, not a signed-in user. */
  actorName: string | null
}
