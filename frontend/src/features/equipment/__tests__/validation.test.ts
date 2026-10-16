import { describe, expect, test } from 'vitest'
import {
  REQUIREMENT_MESSAGES as messages, REQUIREMENT_STATUS_LABELS as labels,
  canManageRequirements, changeReturnsToPendingReview, requirementDisplayStatus, validateRequirement,
} from '../validation'
import type { UserRole } from '../../auth/types'
import type { EventStatus } from '../../events/types'
import type { EquipmentType, RequirementStatus } from '../types'

const coordinatorId = 'coordinator-1'
const assigned = { id: coordinatorId, role: 'coordinator' as const }
const approved = { status: 'approved' as EventStatus, coordinatorId }
const catalogue: EquipmentType[] = [
  { id: 'projector', name: 'Projector', category: 'Visual' },
  { id: 'mic', name: 'Wireless mic', category: 'Audio' },
]
const valid = { typeId: 'projector', quantity: '3', technicalNotes: 'HDMI, 4K', essential: true }

describe('AC-013.1: only the assigned coordinator manages requirements on an approved event', () => {
  test('AC-013.1.1: allows the assigned coordinator on approved, planning and confirmed events', () => {
    for (const status of ['approved', 'planning', 'confirmed'] as EventStatus[]) {
      expect(canManageRequirements({ status, coordinatorId }, assigned)).toBe(true)
    }
  })
  test('AC-013.1.2: blocks every event status that is not approved yet or has finished', () => {
    for (const status of ['draft', 'submitted', 'under_review', 'rejected', 'cancelled', 'completed'] as EventStatus[]) {
      expect(canManageRequirements({ status, coordinatorId }, assigned)).toBe(false)
    }
  })
  test('AC-013.1.3: blocks a coordinator who is not assigned to the event', () => {
    expect(canManageRequirements(approved, { id: 'coordinator-2', role: 'coordinator' })).toBe(false)
  })
  test('AC-013.1.4: blocks other roles even when their id matches the assigned coordinator', () => {
    for (const role of ['organiser', 'tech_support', 'operations_manager', 'venue_staff', 'attendee'] as UserRole[]) {
      expect(canManageRequirements(approved, { id: coordinatorId, role })).toBe(false)
    }
  })
  test('AC-013.1.5: nobody manages requirements on an event without an assigned coordinator', () => {
    expect(canManageRequirements({ status: 'approved', coordinatorId: null }, assigned)).toBe(false)
  })
})

describe('AC-013.2: a catalogue type, a quantity of at least 1 and optional technical requirements', () => {
  test('AC-013.2.1: accepts a catalogue type, a quantity and technical requirements', () => {
    expect(validateRequirement(valid, catalogue)).toEqual({
      ok: true, value: { typeId: 'projector', quantity: 3, technicalNotes: 'HDMI, 4K', essential: true },
    })
  })
  test('AC-013.2.2: accepts the minimum quantity of 1', () => {
    expect(validateRequirement({ ...valid, quantity: 1 }, catalogue)).toMatchObject({ ok: true, value: { quantity: 1 } })
  })
  test('AC-013.2.3: accepts a large quantity because the story sets no upper limit', () => {
    expect(validateRequirement({ ...valid, quantity: '500' }, catalogue)).toMatchObject({ ok: true, value: { quantity: 500 } })
  })
  test('AC-013.2.4: rejects quantity 0', () => {
    expect(validateRequirement({ ...valid, quantity: '0' }, catalogue)).toEqual({ ok: false, errors: { quantity: messages.quantityMin } })
  })
  test('AC-013.2.5: rejects a negative quantity', () => {
    expect(validateRequirement({ ...valid, quantity: -1 }, catalogue)).toEqual({ ok: false, errors: { quantity: messages.quantityMin } })
  })
  test('AC-013.2.6: rejects a quantity that is not a whole number', () => {
    expect(validateRequirement({ ...valid, quantity: '1.5' }, catalogue)).toEqual({ ok: false, errors: { quantity: messages.quantityWhole } })
  })
  test('AC-013.2.7: rejects a blank or non-numeric quantity', () => {
    for (const quantity of ['', '   ', 'abc']) {
      const result = validateRequirement({ ...valid, quantity }, catalogue)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.quantity).toBeTruthy()
    }
  })
  test('AC-013.2.8: requires an equipment type', () => {
    expect(validateRequirement({ ...valid, typeId: '' }, catalogue)).toEqual({ ok: false, errors: { typeId: messages.typeRequired } })
  })
  test('AC-013.2.9: rejects an equipment type that is not in the catalogue', () => {
    expect(validateRequirement({ ...valid, typeId: 'hoverboard' }, catalogue))
      .toEqual({ ok: false, errors: { typeId: messages.typeNotInCatalogue } })
  })
  test('AC-013.2.10: technical requirements are optional and blanks are stored as null', () => {
    for (const technicalNotes of ['', '   ', undefined, null]) {
      expect(validateRequirement({ ...valid, technicalNotes }, catalogue))
        .toMatchObject({ ok: true, value: { technicalNotes: null } })
    }
  })
  test('AC-013.2.11: technical requirements are trimmed', () => {
    expect(validateRequirement({ ...valid, technicalNotes: '  needs HDMI  ' }, catalogue))
      .toMatchObject({ ok: true, value: { technicalNotes: 'needs HDMI' } })
  })
})

describe('AC-013.3: the coordinator sees each requirement status', () => {
  const label = (status: RequirementStatus, essential: boolean) => labels[requirementDisplayStatus(status, essential)]
  test('AC-013.3.1: pending review', () => {
    expect(label('pending_review', true)).toBe('Pending review')
  })
  test('AC-013.3.2: reserved', () => {
    expect(label('reserved', true)).toBe('Reserved')
  })
  test('AC-013.3.3: partially reserved', () => {
    expect(label('partially_reserved', true)).toBe('Partially reserved')
  })
  test('AC-013.3.4: unavailable', () => {
    expect(label('unavailable', true)).toBe('Unavailable')
  })
  test('AC-013.3.5: a non-essential line shows non-essential instead of pending review or unavailable', () => {
    expect(label('pending_review', false)).toBe('Non-essential')
    expect(label('unavailable', false)).toBe('Non-essential')
  })
  test('AC-013.3.6: held equipment is shown even when the line is non-essential', () => {
    expect(label('reserved', false)).toBe('Reserved')
    expect(label('partially_reserved', false)).toBe('Partially reserved')
  })
})

describe('AC-013.6: changing a reserved type or quantity returns the line to pending review', () => {
  const reserved = {
    status: 'reserved' as RequirementStatus, typeId: 'projector', quantity: 2, technicalNotes: null, essential: true,
  }
  const same = { typeId: 'projector', quantity: 2, technicalNotes: null, essential: true }
  test('AC-013.6.1: a reserved line whose quantity changes', () => {
    expect(changeReturnsToPendingReview(reserved, { ...same, quantity: 3 })).toBe(true)
  })
  test('AC-013.6.2: a reserved line whose type changes', () => {
    expect(changeReturnsToPendingReview(reserved, { ...same, typeId: 'mic' })).toBe(true)
  })
  test('AC-013.6.3: a partially reserved line whose quantity changes', () => {
    expect(changeReturnsToPendingReview({ ...reserved, status: 'partially_reserved' }, { ...same, quantity: 1 })).toBe(true)
  })
  test('AC-013.6.4: changing only notes or the essential flag keeps the reservation', () => {
    expect(changeReturnsToPendingReview(reserved, { ...same, technicalNotes: 'needs HDMI' })).toBe(false)
    expect(changeReturnsToPendingReview(reserved, { ...same, essential: false })).toBe(false)
  })
  test('AC-013.6.5: re-entering the same quantity is not a change', () => {
    expect(changeReturnsToPendingReview(reserved, same)).toBe(false)
    expect(changeReturnsToPendingReview({ ...reserved, status: 'partially_reserved' }, same)).toBe(false)
  })
  test('AC-013.6.6: a line with nothing held keeps its status when changed', () => {
    for (const status of ['pending_review', 'unavailable'] as RequirementStatus[]) {
      expect(changeReturnsToPendingReview({ ...reserved, status }, { ...same, typeId: 'mic', quantity: 5 })).toBe(false)
    }
  })
})
