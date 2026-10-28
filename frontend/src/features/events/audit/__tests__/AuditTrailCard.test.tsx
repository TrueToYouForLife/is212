import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuditTrailCard } from '../AuditTrailCard'
import { AUDIT_MESSAGES } from '../auditService'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

const row = (patch: Record<string, unknown>) => ({
  id: 'a-1', action: 'approved', item_type: 'event', item_id: 'e-1', old_values: { status: 'under_review' },
  new_values: { status: 'approved' }, occurred_at: '2040-03-01T01:00:00Z', actor_id: 'u-1', actor_name: 'Casey Coordinator',
  ...patch,
})

describe('AC-034.3 — the assigned Coordinator and the Lead see the audit records in time order', () => {
  test('AC-034.3.11: each record shows what happened, who did it and the change, in the order received', async () => {
    mocks.rpc.mockResolvedValue({ data: [
      row({ id: 'a-1' }),
      row({ id: 'a-2', action: 'rescheduled', actor_id: null, actor_name: null,
        old_values: { expected_attendance: 50 }, new_values: { expected_attendance: 80 } }),
    ], error: null })
    render(<AuditTrailCard eventId="e-1" />)
    const list = await screen.findByRole('list', { name: 'Audit trail' })
    const items = within(list).getAllByRole('listitem').filter((item) => item.parentElement === list)
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Request approved')
    expect(items[0]).toHaveTextContent('by Casey Coordinator')
    expect(items[0]).toHaveTextContent('Status: under review → approved')
    expect(items[1]).toHaveTextContent('Event rescheduled')
    expect(items[1]).toHaveTextContent('by the system')
    expect(items[1]).toHaveTextContent('Expected attendance: 50 → 80')
  })

  test('AC-034.3.12: an event with no records says so', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    render(<AuditTrailCard eventId="e-1" />)
    expect(await screen.findByText('No actions have been recorded for this event yet.')).toBeInTheDocument()
  })

  test('AC-034.3.13: the trail is read again when the page refreshes', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    const { rerender } = render(<AuditTrailCard eventId="e-1" refreshVersion={0} />)
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))
    rerender(<AuditTrailCard eventId="e-1" refreshVersion={1} />)
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2))
  })
})

describe('AC-034.4 — Organisers and Attendees cannot view audit records', () => {
  test('AC-034.4.5: a refused read shows the refusal, not an empty trail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no' } })
    render(<AuditTrailCard eventId="e-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(AUDIT_MESSAGES.notAllowed)
    expect(screen.queryByText('No actions have been recorded for this event yet.')).not.toBeInTheDocument()
  })

  test('AC-034.4.6: a failed read shows an error, not an empty trail', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'down' } })
    render(<AuditTrailCard eventId="e-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(AUDIT_MESSAGES.loadFailed)
  })
})
