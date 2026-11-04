import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuditTrailCard } from '../AuditTrailCard'
import { auditChanges } from '../auditDescription'
import type { AuditEntry } from '../types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('AC-034.3 — the audit trail reads as plain words', () => {
  test('AC-034.3.14: a record with a note but no field changes shows the note alone', async () => {
    mocks.rpc.mockResolvedValue({ data: [{
      id: 'a-1', action: 'venue_rejected', item_type: 'venue_booking', item_id: 'b-1', old_values: null,
      new_values: { review_note: 'Hall closed for repairs' }, occurred_at: '2040-03-01T01:00:00Z',
      actor_id: 'u-1', actor_name: 'Vera Venue',
    }], error: null })
    render(<AuditTrailCard eventId="e-1" />)
    const list = await screen.findByRole('list', { name: 'Audit trail' })
    expect(within(list).getByText('Note: Hall closed for repairs')).toBeInTheDocument()
  })

  test('AC-034.3.15: closing the card before the records arrive drops them quietly', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.rpc.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = render(<AuditTrailCard eventId="e-1" />)
    unmount()
    await act(async () => { finish({ data: [], error: null }) })
    expect(screen.queryByRole('list', { name: 'Audit trail' })).toBeNull()
  })

  test('AC-034.3.16: a record with no new values lists no changes', () => {
    const entry = { id: 'a-1', action: 'details_changed', itemType: 'event', itemId: 'e-1', oldValues: { status: 'planning' },
      newValues: null, occurredAt: '2040-03-01T01:00:00Z', actorId: null, actorName: null } as AuditEntry
    expect(auditChanges(entry)).toEqual([])
  })
})
