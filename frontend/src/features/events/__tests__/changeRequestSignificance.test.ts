import { expect, test } from 'vitest'
import { classifyChangeRequest } from '../changeRequestSignificance'
import type { ProposedEventChanges } from '../types'

const significantCases: [string, keyof ProposedEventChanges, string][] = [
  ['AC-007.11.1', 'proposedStart', '2030-01-01T10:00'],
  ['AC-007.11.2', 'proposedEnd', '2030-01-01T12:00'],
  ['AC-007.11.3', 'expectedAttendance', '80'],
  ['AC-007.11.4', 'layoutPreference', 'Theatre'],
  ['AC-007.11.5', 'accessibilityRequirements', 'Step-free access'],
  ['AC-007.11.6', 'equipmentRequirements', 'Two projectors'],
]
test.each(significantCases)('%s: a proposed change to %s is significant', (_id, field, value) => {
  expect(classifyChangeRequest({ [field]: value })).toEqual({ kind: 'significant', fields: [field] })
})
test('AC-007.11.7: changes only to other supported fields are ordinary edits', () => {
  expect(classifyChangeRequest({ name: 'New title', purpose: 'Meet', eventType: 'Conference',
    description: 'New text', programme: 'Welcome', registrationRequired: false, specialArrangements: 'New note',
  })).toEqual({ kind: 'ordinary', fields: [] })
})
test('AC-007.11.8: absent or undefined fields do not falsely flag a significant change', () => {
  expect(classifyChangeRequest({})).toEqual({ kind: 'ordinary', fields: [] })
  expect(classifyChangeRequest({ equipmentRequirements: undefined })).toEqual({ kind: 'ordinary', fields: [] })
})
test('AC-007.11.9: removing an equipment requirement still counts as a significant change', () => {
  expect(classifyChangeRequest({ equipmentRequirements: '' })).toEqual({ kind: 'significant', fields: ['equipmentRequirements'] })
})
test('AC-007.11.10: a mixed request lists significant fields in stable order without mutating the proposal', () => {
  const proposal = { equipmentRequirements: 'Projector', name: 'New title', expectedAttendance: '20', proposedStart: '2030-01-01T10:00' }
  const before = structuredClone(proposal)
  expect(classifyChangeRequest(proposal)).toEqual({ kind: 'significant', fields: ['proposedStart', 'expectedAttendance', 'equipmentRequirements'] })
  expect(proposal).toEqual(before)
})
