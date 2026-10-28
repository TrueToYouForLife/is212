import { describe, expect, test } from 'vitest'
import { auditChanges, auditNote, auditTitle } from '../auditDescription'
import type { AuditEntry } from '../types'

const entry = (patch: Partial<AuditEntry>): AuditEntry => ({
  id: 'a-1', action: 'details_changed', itemType: 'event', itemId: 'e-1', oldValues: null, newValues: null,
  occurredAt: '2040-03-01T01:00:00Z', actorId: null, actorName: null, ...patch,
})

describe('AC-034.3 — the audit trail reads as plain words', () => {
  test('AC-034.3.7: known actions have titles and an unknown one still reads as words', () => {
    expect(auditTitle('rescheduled')).toBe('Event rescheduled')
    expect(auditTitle('safety_outcome_recorded')).toBe('Safety outcome recorded')
  })

  test('AC-034.3.8: changed fields show old and new values, with dates in Singapore time', () => {
    const lines = auditChanges(entry({
      oldValues: { expected_attendance: 50, layout_preference: null, proposed_start: '2040-03-04T01:00:00Z' },
      newValues: { expected_attendance: 80, layout_preference: 'cabaret', proposed_start: '2040-03-04T02:00:00Z' },
    }))
    expect(lines[0]).toBe('Expected attendance: 50 → 80')
    expect(lines[1]).toBe('Layout: none → cabaret')
    expect(lines[2]).toBe('Start: 4 Mar 2040, 09:00 → 4 Mar 2040, 10:00')
  })

  test('AC-034.3.9: identifiers are never shown, and a status without an old value shows only the new one', () => {
    expect(auditChanges(entry({
      newValues: { coordinator_id: '34000000-0000-0000-0000-000000000003', venue_id: 'v-1', type_id: 't-1' },
    }))).toEqual([])
    expect(auditChanges(entry({ newValues: { status: 'pending_approval', quantity_reserved: 2 } })))
      .toEqual(['Status: pending approval', 'Quantity reserved: 2'])
  })

  test('AC-034.3.10: a venue decision note is shown only when it has text', () => {
    expect(auditNote(entry({ newValues: { review_note: 'Approved for hall' } }))).toBe('Approved for hall')
    expect(auditNote(entry({ newValues: { review_note: '  ' } }))).toBeNull()
    expect(auditNote(entry({ newValues: null }))).toBeNull()
  })
})
