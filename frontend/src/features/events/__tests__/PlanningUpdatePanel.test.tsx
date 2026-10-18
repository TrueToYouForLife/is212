import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { PlanningUpdatePanel } from '../components/PlanningUpdatePanel'
import type { PlanningDetails } from '../planningUpdateService'
import { EMPTY_REQUIREMENT_CATALOGUE } from '../requirementCatalogue'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), catalogue: vi.fn() }))
vi.mock('../planningUpdateService', () => ({ getEventPlanning: mocks.load, updateEventPlanning: mocks.save }))
vi.mock('../requirementCatalogueService', () => ({ loadRequirementCatalogue: mocks.catalogue }))
const eventId = '20020000-0000-4000-8000-000000000001'
const details: PlanningDetails = { version: 'v1', status: 'approved', values: {
  name: 'Workshop', purpose: 'Planning', eventType: null, description: null,
  proposedStart: '2099-01-10T01:00:00Z', proposedEnd: '2099-01-10T03:00:00Z', expectedAttendance: 10,
  programme: null, layoutPreference: null, accessibilityRequirements: [], facilityRequirements: [], equipmentRequirements: [], specialArrangements: null,
}, history: [] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, value: structuredClone(details) })
  mocks.catalogue.mockResolvedValue({ ok: true, catalogue: EMPTY_REQUIREMENT_CATALOGUE })
  mocks.save.mockResolvedValue({ ok: true, changed: true })
})
test('AC-020.1.50: assigned coordinator edits existing values and refreshes after a successful save', async () => {
  const onChanged = vi.fn()
  render(<PlanningUpdatePanel eventId={eventId} onChanged={onChanged} />)
  const name = await screen.findByLabelText('Event name')
  expect(name).toHaveValue('Workshop')
  expect(screen.queryByLabelText(/Attendees must register/)).not.toBeInTheDocument()
  await userEvent.clear(name)
  await userEvent.type(name, 'Updated workshop')
  await userEvent.click(screen.getByRole('button', { name: 'Save planning details' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(mocks.save).toHaveBeenCalledWith(eventId, 'v1', expect.objectContaining({ name: 'Updated workshop' }), { layouts: [], equipment: [] })
  expect(screen.getByRole('status')).toHaveTextContent('Planning details saved.')
})
test('AC-020.1.51: invalid attendance and purpose show validation without attempting a save', async () => {
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  await userEvent.clear(await screen.findByLabelText('Purpose of the event'))
  await userEvent.clear(screen.getByLabelText('Expected number of attendees'))
  await userEvent.type(screen.getByLabelText('Expected number of attendees'), '0')
  await userEvent.click(screen.getByRole('button', { name: 'Save planning details' }))
  expect(await screen.findByText('Purpose is required.')).toBeInTheDocument()
  expect(screen.getByText(/must be at least 1/)).toBeInTheDocument()
  expect(mocks.save).not.toHaveBeenCalled()
})
test('AC-020.1.52: a stale save preserves entered text until the user explicitly reloads', async () => {
  mocks.save.mockResolvedValue({ ok: false, reason: 'Event changed. Reload before saving.' })
  const changed = vi.fn()
  render(<PlanningUpdatePanel eventId={eventId} onChanged={changed} />)
  const name = await screen.findByLabelText('Event name')
  await userEvent.type(name, ' unsaved')
  await userEvent.click(screen.getByRole('button', { name: 'Save planning details' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Event changed')
  expect(name).toHaveValue('Workshop unsaved')
  expect(changed).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Reload planning details/ }))
  expect(await screen.findByLabelText('Event name')).toHaveValue('Workshop')
})
test('AC-020.1.53: pending save disables inputs and prevents duplicate requests', async () => {
  let finish!: (result: { ok: true; changed: boolean }) => void
  mocks.save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Save planning details' }))
  expect(screen.getByLabelText('Event name')).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Saving…' }))
  expect(mocks.save).toHaveBeenCalledOnce()
  await act(async () => finish({ ok: true, changed: false }))
  expect(await screen.findByRole('status')).toHaveTextContent('No changes to save.')
})
test('AC-020.1.54: catalogue failure blocks edits without hiding existing history', async () => {
  mocks.catalogue.mockResolvedValue({ ok: false, reason: 'Options unavailable', catalogue: EMPTY_REQUIREMENT_CATALOGUE })
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Options unavailable')
  expect(screen.queryByRole('button', { name: 'Save planning details' })).not.toBeInTheDocument()
  expect(screen.getByText('No planning updates recorded.')).toBeInTheDocument()
})
test('AC-020.1.55: completed events retain history but expose no editing controls', async () => {
  mocks.load.mockResolvedValue({ ok: true, value: { ...details, status: 'completed' } })
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  expect(await screen.findByText(/only be edited while/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Event name')).not.toBeInTheDocument()
})
test('AC-020.2.7: history displays oldest first with actor, timestamp and before/after details', async () => {
  mocks.load.mockResolvedValue({ ok: true, value: { ...details, history: [
    { id: 'first', changed_by_name: 'First Coordinator', changed_at: '2026-01-01T01:00:00Z', changes: { name: { before: null, after: 'Workshop' }, facilityRequirements: { before: [], after: ['wifi', 'stage'] } } },
    { id: 'second', changed_by_name: 'Second Coordinator', changed_at: '2026-01-02T01:00:00Z', changes: { purpose: { before: 'Planning', after: 'Final planning' }, customField: { before: '', after: 'Value' } } },
  ] } })
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  await screen.findByText(/First Coordinator/)
  const entries = screen.getAllByRole('list')[0].children
  expect(within(entries[0] as HTMLElement).getByText(/First Coordinator/)).toHaveTextContent('(Singapore)')
  expect(entries[0]).toHaveTextContent('Event name: None → Workshop')
  expect(entries[0]).toHaveTextContent('Facilities: None → wifi, stage')
  expect(entries[1]).toHaveTextContent('Second Coordinator')
})
test('AC-020.2.8: read errors are explicit and reload recovers instead of showing a false empty history', async () => {
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'History unavailable' })
  render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable')
  expect(screen.queryByText('No planning updates recorded.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Reload planning details/ }))
  expect(await screen.findByText('No planning updates recorded.')).toBeInTheDocument()
})
test('AC-020.2.9: unexpected load rejection is reported and a response after unmount is ignored', async () => {
  mocks.load.mockRejectedValueOnce(new Error('offline'))
  const view = render(<PlanningUpdatePanel eventId={eventId} onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  let finish!: (result: { ok: true; value: PlanningDetails }) => void
  mocks.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await userEvent.click(screen.getByRole('button', { name: /Reload planning details/ }))
  view.unmount()
  await act(async () => finish({ ok: true, value: details }))
})
