import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { EquipmentStatusPanel } from '../components/EquipmentStatusPanel'
import { EquipmentCataloguePage } from '../pages/EquipmentCataloguePage'
import { SessionContext, type CurrentUser } from '../../auth/sessionContext'
import type { UserRole } from '../../auth/types'
import type { EquipmentStatusDetails, EquipmentStatusResult } from '../equipmentStatusService'
import type { EquipmentCatalogue } from '../equipmentCatalogueService'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), catalogue: vi.fn() }))
vi.mock('../equipmentStatusService', () => ({ loadEquipmentStatus: mocks.load, saveEquipmentStatus: mocks.save }))
vi.mock('../equipmentCatalogueService', () => ({ loadEquipmentCatalogue: mocks.catalogue }))
const itemId = 'a1050000-0000-0000-0004-000000000001'
const details: EquipmentStatusDetails = { id: itemId, assetTag: 'P-1', status: 'operational', version: 0, history: [] }
const catalogue: EquipmentCatalogue = { types: [{ id: 'projector', name: 'Projector', category: 'Video', description: 'HDMI', totalUnits: 1, usableUnits: 1 }],
  units: [{ id: itemId, typeId: 'projector', assetTag: 'P-1', status: 'operational', locationId: 'store', locationName: 'Store', locationDescription: 'Level 1' }] }
function current(role: UserRole): CurrentUser {
  return { profile: { id: 'same-user', fullName: 'Fixture', role }, session: null, loading: false, refresh: vi.fn() }
}
function page(role: UserRole) {
  return <SessionContext.Provider value={current(role)}><EquipmentCataloguePage /></SessionContext.Provider>
}
const panel = (onSaved = vi.fn(), onClose = vi.fn()) => <EquipmentStatusPanel itemId={itemId} assetTag="P-1" onSaved={onSaved} onClose={onClose} />
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, data: details })
  mocks.catalogue.mockResolvedValue({ ok: true, data: catalogue })
  mocks.save.mockResolvedValue({ ok: true, data: { id: itemId, version: 1, changed: true, reviewCount: 2 } })
})

test('AC-027.5.7: requires an explicit supported target and nonblank reason, then submits the loaded version', async () => {
  const actor = userEvent.setup(), saved = vi.fn()
  render(panel(saved))
  await screen.findByText('Current status: Operational')
  expect(screen.getByText('No status changes recorded.')).toBeInTheDocument()
  expect(within(screen.getByLabelText('New status')).getAllByRole('option').map((option) => option.textContent))
    .toEqual(['Choose a status', 'Operational', 'Damaged', 'Under Maintenance', 'Unavailable'])
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  expect(mocks.save).not.toHaveBeenCalled()
  await actor.selectOptions(screen.getByLabelText('New status'), 'unavailable')
  await actor.type(screen.getByLabelText('Reason for status change'), '   ')
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  expect(mocks.save).not.toHaveBeenCalled()
  await actor.clear(screen.getByLabelText('Reason for status change'))
  await actor.type(screen.getByLabelText('Reason for status change'), 'Awaiting inspection')
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(mocks.save).toHaveBeenCalledWith({ itemId, status: 'unavailable', note: 'Awaiting inspection', version: 0 })
  expect(saved).toHaveBeenCalledWith({ id: itemId, version: 1, changed: true, reviewCount: 2 })
})

test('AC-027.5.8: pending save cannot be duplicated, closed or reloaded and retains its submitted values', async () => {
  const actor = userEvent.setup(), saved = vi.fn(), closed = vi.fn()
  let finish!: (value: { ok: true; data: EquipmentStatusResult }) => void
  mocks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  render(panel(saved, closed))
  await screen.findByText('Current status: Operational')
  await actor.selectOptions(screen.getByLabelText('New status'), 'needs_repair')
  await actor.type(screen.getByLabelText('Reason for status change'), 'Broken lamp')
  await actor.dblClick(screen.getByRole('button', { name: 'Save status' }))
  for (const label of ['Saving…', 'Reload unit', 'Close status panel']) expect(screen.getByRole('button', { name: label })).toBeDisabled()
  expect(screen.getByLabelText('Reason for status change')).toBeDisabled()
  expect(screen.getByLabelText('New status')).toBeDisabled()
  expect(mocks.save).toHaveBeenCalledTimes(1)
  await act(async () => finish({ ok: true, data: { id: itemId, version: 1, changed: true, reviewCount: 0 } }))
  expect(saved).toHaveBeenCalledTimes(1)
  expect(closed).not.toHaveBeenCalled()
})

test('AC-027.5.9: failed or stale save retains the note, blocks retry and never silently reloads consent; explicit reload uses the fresh version', async () => {
  const actor = userEvent.setup()
  for (const reason of ['This equipment unit changed. Reload.', 'The save result could not be confirmed. Reload.']) {
    mocks.load.mockClear()
    mocks.save.mockClear()
    mocks.save.mockResolvedValueOnce({ ok: false, reason })
    const view = render(panel())
    await screen.findByText('Current status: Operational')
    await actor.selectOptions(screen.getByLabelText('New status'), 'needs_repair')
    await actor.type(screen.getByLabelText('Reason for status change'), 'Keep this explanation')
    await actor.click(screen.getByRole('button', { name: 'Save status' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(reason)
    expect(screen.getByLabelText('Reason for status change')).toHaveValue('Keep this explanation')
    expect(screen.getByRole('button', { name: 'Save status' })).toBeDisabled()
    expect(mocks.load).toHaveBeenCalledTimes(1)
    mocks.load.mockResolvedValueOnce({ ok: true, data: { ...details, status: 'under_repair', version: 4 } })
    await actor.click(screen.getByRole('button', { name: 'Reload unit' }))
    await screen.findByText('Current status: Under Maintenance')
    expect(screen.getByLabelText('Reason for status change')).toHaveValue('Keep this explanation')
    expect(screen.getByLabelText('New status')).toHaveValue('needs_repair')
    mocks.save.mockResolvedValueOnce({ ok: true, data: { id: itemId, version: 5, changed: true, reviewCount: 0 } })
    await actor.click(screen.getByRole('button', { name: 'Save status' }))
    expect(mocks.save).toHaveBeenLastCalledWith({ itemId, status: 'needs_repair', note: 'Keep this explanation', version: 4 })
    view.unmount()
  }
})

test('AC-027.1.6: unavailable status/history is an error, not false empty history; reload restores the current unit', async () => {
  const actor = userEvent.setup()
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Could not load status history.' })
  render(panel())
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load status history.')
  expect(screen.queryByText('No status changes recorded.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save status' })).toBeDisabled()
  await actor.click(screen.getByRole('button', { name: 'Reload unit' }))
  expect(await screen.findByText('Current status: Operational')).toBeInTheDocument()
})

test('AC-027.8.7: only Technical Support can open management; role loss unmounts it and ignores a late save response', async () => {
  const actor = userEvent.setup()
  const view = render(page('coordinator'))
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: 'Manage status for P-1' })).not.toBeInTheDocument()
  expect(mocks.load).not.toHaveBeenCalled()
  view.rerender(page('tech_support'))
  await actor.click(await screen.findByRole('button', { name: 'Manage status for P-1' }))
  await screen.findByText('Current status: Operational')
  await actor.selectOptions(screen.getByLabelText('New status'), 'needs_repair')
  await actor.type(screen.getByLabelText('Reason for status change'), 'Broken lamp')
  let finish!: (value: { ok: true; data: EquipmentStatusResult }) => void
  mocks.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  view.rerender(page('coordinator'))
  await screen.findByRole('table')
  const loads = mocks.catalogue.mock.calls.length
  await act(async () => finish({ ok: true, data: { id: itemId, version: 1, changed: true, reviewCount: 0 } }))
  expect(screen.queryByRole('region', { name: 'Manage equipment status: P-1' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Status updated/)).not.toBeInTheDocument()
  expect(mocks.catalogue).toHaveBeenCalledTimes(loads)
})

test('AC-027.8.8: history shows stored actor, note and Singapore time with original retired/missing meanings', async () => {
  mocks.load.mockResolvedValueOnce({ ok: true, data: { ...details, status: 'retired', version: 1, history: [{
    id: 'change-1', previousStatus: 'missing', newStatus: 'unavailable', note: 'Found; inspection required',
    changedBy: 'staff-1', changedByName: 'Stored staff name', changedAt: '2026-10-22T18:15:00Z', version: 1,
  }] } })
  render(panel())
  await screen.findByText('Current status: Unavailable (retired)')
  const history = screen.getByRole('region', { name: 'Equipment status history' })
  expect(within(history).getByText('Unavailable (missing) → Unavailable')).toBeInTheDocument()
  expect(within(history).getByText('Found; inspection required')).toBeInTheDocument()
  expect(within(history).getByText(/Stored staff name/)).toHaveTextContent(/23 Oct 2026.*02:15.*Singapore time/)
})

test('AC-027.2.3: confirmed save closes management, refreshes stock and retains filters; reopening loads fresh history and no-op also closes', async () => {
  const actor = userEvent.setup()
  const other = { ...catalogue.units[0], id: 'a1050000-0000-0000-0004-000000000002', assetTag: 'P-2', status: 'under_repair' as const }
  mocks.catalogue.mockResolvedValueOnce({ ok: true, data: { ...catalogue,
    types: [{ ...catalogue.types[0], totalUnits: 2 }], units: [catalogue.units[0], other] } })
  render(page('tech_support'))
  await screen.findByRole('table')
  await actor.selectOptions(screen.getByLabelText('Equipment type'), 'projector')
  await actor.selectOptions(screen.getByLabelText('Operational status'), 'Operational')
  await actor.click(screen.getByRole('button', { name: 'Manage status for P-1' }))
  await screen.findByText('Current status: Operational')
  expect(screen.getByRole('button', { name: 'Refresh catalogue' })).toBeDisabled()
  await actor.selectOptions(screen.getByLabelText('New status'), 'needs_repair')
  await actor.type(screen.getByLabelText('Reason for status change'), 'Broken lamp')
  const next = { ...catalogue, types: [{ ...catalogue.types[0], totalUnits: 2, usableUnits: 0 }],
    units: [{ ...catalogue.units[0], status: 'needs_repair' as const }, other] }
  mocks.catalogue.mockResolvedValue({ ok: true, data: next })
  mocks.load.mockResolvedValue({ ok: true, data: { ...details, status: 'needs_repair', version: 1, history: [{
    id: 'saved-change', previousStatus: 'operational', newStatus: 'needs_repair', note: 'Broken lamp',
    changedBy: 'staff-1', changedByName: 'Stored staff name', changedAt: '2026-10-23T04:00:00Z', version: 1,
  }] } })
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  await screen.findByText('0 usable / 2 total units')
  expect(screen.queryByRole('region', { name: 'Manage equipment status: P-1' })).not.toBeInTheDocument()
  expect(screen.getByText('No equipment units match these filters.')).toBeInTheDocument()
  expect(screen.getByLabelText('Equipment type')).toHaveValue('projector')
  expect(screen.getByText('Status updated. 2 reservations were flagged for review.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh catalogue' })).toBeEnabled()
  expect(mocks.load).toHaveBeenCalledTimes(1)
  await actor.click(screen.getByRole('button', { name: 'Reset filters' }))
  mocks.load.mockResolvedValueOnce({ ok: true, data: { ...details, id: other.id, assetTag: 'P-2', status: 'under_repair' } })
  await actor.click(screen.getByRole('button', { name: 'Manage status for P-2' }))
  await screen.findByText('Current status: Under Maintenance')
  await actor.click(screen.getByRole('button', { name: 'Close status panel' }))
  await actor.click(screen.getByRole('button', { name: 'Manage status for P-1' }))
  await screen.findByText('Current status: Damaged')
  expect(within(screen.getByRole('region', { name: 'Equipment status history' })).getByText('Broken lamp')).toBeInTheDocument()
  expect(mocks.load).toHaveBeenCalledTimes(3)
  await actor.selectOptions(screen.getByLabelText('New status'), 'needs_repair')
  await actor.type(screen.getByLabelText('Reason for status change'), 'Already recorded')
  mocks.save.mockResolvedValueOnce({ ok: true, data: { id: itemId, version: 1, changed: false, reviewCount: 0 } })
  await actor.click(screen.getByRole('button', { name: 'Save status' }))
  await waitFor(() => expect(screen.getByText('Status unchanged. No new history or notifications were created.')).toBeInTheDocument())
  expect(screen.queryByRole('region', { name: 'Manage equipment status: P-1' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh catalogue' })).toBeEnabled()
})
