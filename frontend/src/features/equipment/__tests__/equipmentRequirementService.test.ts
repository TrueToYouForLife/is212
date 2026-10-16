import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  EQUIPMENT_SERVICE_MESSAGES as messages, addRequirement, loadAllRequirements, loadCatalogue,
  loadEventRequirements, loadMyEquipmentNotifications, updateRequirement,
} from '../equipmentRequirementService'
import { REQUIREMENT_MESSAGES } from '../validation'
import type { EquipmentType } from '../types'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))

type QueryResult = { data: unknown; error: unknown }
/** Every builder method returns the builder; awaiting it, or single(), yields the result. */
function query(result: QueryResult) {
  const builder = {
    select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), order: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const method of [builder.select, builder.insert, builder.update, builder.delete, builder.eq, builder.order]) {
    method.mockReturnValue(builder)
  }
  mocks.from.mockReturnValue(builder)
  return builder
}

const catalogue: EquipmentType[] = [{ id: 'projector', name: 'Projector', category: 'Visual' }]
const input = { typeId: 'projector', quantity: '3', technicalNotes: ' HDMI ', essential: true }
const requirementRow = {
  id: 'req-1', event_id: 'event-1', type_id: 'projector', quantity: 2, technical_notes: null,
  essential: true, status: 'pending_review', equipment_types: { name: 'Projector' },
}
const eventRow = {
  id: 'event-1', reference: 'EVT-2026-0001', name: 'Launch', status: 'approved', coordinator_id: 'coordinator-1',
  equipment_requirements: '2 projectors, 4 mics', event_equipment_requirements: [requirementRow],
}
const mappedRequirement = {
  id: 'req-1', eventId: 'event-1', typeId: 'projector', typeName: 'Projector', quantity: 2, technicalNotes: null,
  essential: true, status: 'pending_review', displayStatus: 'pending_review',
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-013.1: assigned-coordinator writes with the organiser request shown', () => {
  test('AC-013.1.6: loads the organiser equipment request with the requirements in one query', async () => {
    const builder = query({ data: eventRow, error: null })
    expect(await loadEventRequirements('event-1')).toEqual({
      ok: true,
      data: {
        event: {
          id: 'event-1', reference: 'EVT-2026-0001', name: 'Launch', status: 'approved',
          coordinatorId: 'coordinator-1', organiserEquipment: '2 projectors, 4 mics',
        },
        requirements: [mappedRequirement],
      },
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('events')
    expect(builder.eq).toHaveBeenCalledWith('id', 'event-1')
  })
  test('AC-013.1.7: a database permission refusal explains who may change requirements', async () => {
    query({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } })
    expect(await addRequirement('event-1', input, catalogue)).toEqual({ ok: false, reason: messages.forbidden })
  })
  test('AC-013.1.8: an event that is not approved explains why the change was refused', async () => {
    query({ data: null, error: { code: '22000', message: 'Event is not approved' } })
    expect(await addRequirement('event-1', input, catalogue)).toEqual({ ok: false, reason: messages.notEligible })
  })
})

describe('AC-013.2: catalogue type, quantity and technical requirements', () => {
  test('AC-013.2.12: saves only the fields the coordinator controls', async () => {
    const builder = query({ data: { ...requirementRow, quantity: 3, technical_notes: 'HDMI' }, error: null })
    expect(await addRequirement('event-1', input, catalogue)).toEqual({
      ok: true, data: { ...mappedRequirement, quantity: 3, technicalNotes: 'HDMI' },
    })
    expect(builder.insert).toHaveBeenCalledWith({
      event_id: 'event-1', type_id: 'projector', quantity: 3, technical_notes: 'HDMI', essential: true,
    })
  })
  test('AC-013.2.13: invalid input never reaches Supabase', async () => {
    expect(await addRequirement('event-1', { ...input, quantity: '0' }, catalogue))
      .toMatchObject({ ok: false, errors: { quantity: REQUIREMENT_MESSAGES.quantityMin } })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  test('AC-013.2.14: a type removed from the catalogue since loading is reported clearly', async () => {
    query({ data: null, error: { code: '23503', message: 'foreign key violation' } })
    expect(await addRequirement('event-1', input, catalogue)).toEqual({ ok: false, reason: messages.typeMissing })
  })
  test('AC-013.2.15: loads the catalogue sorted by category, then name', async () => {
    query({
      data: [
        { id: 'projector', name: 'Projector', category: 'Visual' },
        { id: 'mic', name: 'Wireless mic', category: 'Audio' },
        { id: 'camera', name: 'Camera', category: 'Visual' },
      ],
      error: null,
    })
    const result = await loadCatalogue()
    expect(result.ok && result.data.map(({ name }) => name)).toEqual(['Wireless mic', 'Camera', 'Projector'])
    expect(mocks.from).toHaveBeenCalledWith('equipment_types')
  })
})

describe('AC-013.3: each requirement status', () => {
  test('AC-013.3.7: maps stored statuses and the essential flag to display statuses', async () => {
    const rows = [
      ['pending_review', true], ['reserved', true], ['partially_reserved', true], ['unavailable', true],
      ['pending_review', false],
    ].map(([status, essential], index) => ({ ...requirementRow, id: `req-${index}`, status, essential }))
    query({ data: { ...eventRow, event_equipment_requirements: rows }, error: null })
    const result = await loadEventRequirements('event-1')
    expect(result.ok && result.data.requirements.map(({ displayStatus }) => displayStatus))
      .toEqual(['pending_review', 'reserved', 'partially_reserved', 'unavailable', 'non_essential'])
  })
  test('AC-013.3.8: a load failure returns an error and no partial data', async () => {
    query({ data: null, error: { code: 'XX000', message: 'private details' } })
    expect(await loadEventRequirements('event-1')).toEqual({ ok: false, reason: messages.loadFailed })
  })
})

describe('AC-013.4: technical support reads requirements and notifications', () => {
  test('AC-013.4.1: loads every requirement with its event for technical support', async () => {
    const builder = query({
      data: [{
        ...requirementRow,
        events: { reference: 'EVT-2026-0001', name: 'Launch', proposed_start: '2035-03-01T01:00:00Z', proposed_end: '2035-03-01T02:00:00Z' },
      }],
      error: null,
    })
    expect(await loadAllRequirements()).toEqual({
      ok: true,
      data: [{
        ...mappedRequirement, eventReference: 'EVT-2026-0001', eventName: 'Launch',
        eventStart: '2035-03-01T01:00:00Z', eventEnd: '2035-03-01T02:00:00Z',
      }],
    })
    expect(mocks.from).toHaveBeenCalledWith('event_equipment_requirements')
    expect(builder.select.mock.calls[0][0]).toContain('events')
  })
  test('AC-013.4.2: loads the signed-in user notifications newest first', async () => {
    const row = (id: string, createdAt: string, action: string) => ({
      id, action, event_id: 'event-1', type_name: 'Projector', quantity: 2, created_at: createdAt,
      events: { reference: 'EVT-2026-0001' },
    })
    query({
      data: [row('n1', '2035-01-01T00:00:00Z', 'added'), row('n3', '2035-01-03T00:00:00Z', 'removed'),
        row('n2', '2035-01-02T00:00:00Z', 'changed')],
      error: null,
    })
    const result = await loadMyEquipmentNotifications()
    expect(result.ok && result.data.map(({ id }) => id)).toEqual(['n3', 'n2', 'n1'])
    expect(result.ok && result.data[0]).toEqual({
      id: 'n3', action: 'removed', eventId: 'event-1', eventReference: 'EVT-2026-0001',
      typeName: 'Projector', quantity: 2, createdAt: '2035-01-03T00:00:00Z',
    })
    expect(mocks.from).toHaveBeenCalledWith('equipment_requirement_notifications')
  })
  test('AC-013.4.3: a notification load failure returns an error', async () => {
    query({ data: null, error: { code: 'XX000', message: 'private details' } })
    expect(await loadMyEquipmentNotifications()).toEqual({ ok: false, reason: messages.notificationsFailed })
  })
})

describe('AC-013.5: recording a requirement does not reserve equipment', () => {
  test('AC-013.5.1: adding and editing touch only the requirements table, never reservations', async () => {
    query({ data: requirementRow, error: null })
    await addRequirement('event-1', input, catalogue)
    await updateRequirement('req-1', input, catalogue)
    expect(mocks.from.mock.calls.map(([table]) => table))
      .toEqual(['event_equipment_requirements', 'event_equipment_requirements'])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
