import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { EquipmentReturnsPage } from '../pages/EquipmentReturnsPage'
import { SessionContext, type CurrentUser } from '../../auth/sessionContext'
import { USER_ROLES, type UserRole } from '../../auth/types'
import { TopNav } from '../../../components/layout/TopNav'
import { EQUIPMENT_RETURN_MESSAGES as messages, type EquipmentReturns } from '../equipmentReturnService'
import { allocation, anotherAllocation, inspection, inspectionReceipt, returnsData } from './fixtures/equipmentReturns'

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('../equipmentReturnService', async original => ({
  ...await original<typeof import('../equipmentReturnService')>(), loadEquipmentReturns: mocks.load, saveReturnInspection: mocks.save,
}))
vi.mock('../../notifications/useUnreadNotificationCount', () => ({ useUnreadNotificationCount: () => 0 }))
function current(role: UserRole | null = 'tech_support', loading = false, id = 'staff'): CurrentUser {
  return { profile: role ? { id, fullName: 'Fixture', role } : null, session: null, loading, refresh: vi.fn() }
}
function page(user = current(), nav = false) {
  return <MemoryRouter><SessionContext.Provider value={user}>
    {nav && <TopNav session={null} profile={user.profile} loading={user.loading} />}
    <EquipmentReturnsPage />
  </SessionContext.Provider></MemoryRouter>
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const openFirst = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.click(await screen.findByRole('button', { name: 'Record inspection for P-24 (EVT-24)' }))
}
async function damage(actor: ReturnType<typeof userEvent.setup>) {
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'damage')
  await actor.type(screen.getByLabelText('Findings / reason for status change', { exact: false }), 'Cracked lens')
  await actor.selectOptions(screen.getByLabelText('Resulting operational status'), 'needs_repair')
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, data: returnsData() })
  mocks.save.mockResolvedValue({ ok: true, data: inspectionReceipt() })
})

test('AC-024.1.13: tabs show server-classified allocations and recorded history with identity, legacy meanings and Singapore times', async () => {
  const actor = userEvent.setup()
  const pending = { ...allocation, operationalStatus: 'unavailable' as const, lastFinding: 'missing' as const, lastInspectedAt: inspection.inspectedAt }
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [pending, anotherAllocation] }) })
  render(page())
  expect(await screen.findByRole('tab', { name: 'Pending checks (2)' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Missing reported · follow-up needed')).toBeInTheDocument()
  expect(screen.getAllByText('24 Oct 2026')).toHaveLength(2)
  expect(screen.getAllByText('26 Oct 2026')).toHaveLength(2)
  await actor.click(screen.getByRole('tab', { name: 'Out (1)' }))
  expect(screen.getByText('Another event')).toBeInTheDocument()
  expect(screen.getByText('29 Oct 2026')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Record inspection/ })).not.toBeInTheDocument()
  await actor.click(screen.getByRole('tab', { name: 'History (1)' }))
  expect(screen.getByText('LEGACY-24 · Projector')).toBeInTheDocument()
  expect(screen.getByText('Finding: No issues')).toBeInTheDocument()
  expect(screen.getByText('Checked case and cable')).toBeInTheDocument()
  expect(screen.getByText(/Unavailable \(retired\) → Unavailable \(retired\)/)).toBeInTheDocument()
  expect(screen.getByText(/Stored staff name.*27 Oct 2026.*00:15.*Singapore time/)).toBeInTheDocument()
})

test('AC-024.1.14: loading and errors are distinct from empty lists; retry and refresh replace obsolete allocations', async () => {
  const actor = userEvent.setup(), first = deferred<{ ok: false; reason: string }>()
  mocks.load.mockReturnValueOnce(first.promise)
  render(page())
  expect(screen.getByText('Loading equipment returns…')).toBeInTheDocument()
  expect(screen.queryByText('No equipment is pending inspection.')).not.toBeInTheDocument()
  await act(async () => first.resolve({ ok: false, reason: messages.load }))
  expect(screen.getByRole('alert')).toHaveTextContent(messages.load)
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData() })
  await actor.click(screen.getByRole('button', { name: 'Refresh returns' }))
  expect(await screen.findByText('P-24')).toBeInTheDocument()
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ out: [], pendingChecks: [], history: [] }) })
  await actor.click(screen.getByRole('button', { name: 'Refresh returns' }))
  expect(await screen.findByText('No equipment is pending inspection.')).toBeInTheDocument()
  expect(screen.queryByText('P-24')).not.toBeInTheDocument()
  await actor.click(screen.getByRole('tab', { name: 'Out (0)' }))
  expect(screen.getByText('No equipment is scheduled out today.')).toBeInTheDocument()
  await actor.click(screen.getByRole('tab', { name: 'History (0)' }))
  expect(screen.getByText('No return inspections recorded.')).toBeInTheDocument()
})

test('AC-024.1.15: only Technical Support sees the navigation/page; auth loading and role loss cannot expose late list results', async () => {
  for (const role of [...USER_ROLES, null]) {
    const view = render(page(current(role), true))
    if (role === 'tech_support') {
      expect(await screen.findByRole('tab', { name: 'Pending checks (2)' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Equipment returns' })).toHaveAttribute('href', '/equipment/returns')
    } else {
      expect(screen.getByText('This page is for Technical Support Staff.')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Equipment returns' })).not.toBeInTheDocument()
    }
    view.unmount()
  }
  expect(mocks.load).toHaveBeenCalledTimes(1)
  const late = deferred<{ ok: true; data: EquipmentReturns }>()
  mocks.load.mockReturnValueOnce(late.promise)
  const view = render(page(current('tech_support', true)))
  expect(screen.getByText('Checking access…')).toBeInTheDocument()
  expect(mocks.load).toHaveBeenCalledTimes(1)
  view.rerender(page(current()))
  expect(mocks.load).toHaveBeenCalledTimes(2)
  view.rerender(page(current('coordinator')))
  await act(async () => late.resolve({ ok: true, data: returnsData() }))
  expect(screen.queryByText('P-24')).not.toBeInTheDocument()
})

test('AC-024.1.16: findings and issue notes are explicit; missing forces Unavailable and no-issue keeps the current damaged status', async () => {
  const actor = userEvent.setup()
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [{ ...allocation, operationalStatus: 'needs_repair' }] }) })
  render(page()); await openFirst(actor)
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(mocks.save).not.toHaveBeenCalled()
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'damage')
  await actor.type(screen.getByLabelText('Findings / reason for status change', { exact: false }), '   ')
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Describe the issue')
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'missing')
  expect(screen.getByLabelText('Resulting operational status')).toBeDisabled()
  expect(screen.getByLabelText('Resulting operational status')).toHaveValue('unavailable')
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'good')
  expect(screen.getByRole('option', { name: 'Keep current status (Damaged)' })).toBeInTheDocument()
  await actor.clear(screen.getByLabelText('Findings / reason for status change', { exact: false }))
  const saved = inspectionReceipt({ finding: 'good', status: 'needs_repair', statusVersion: 0, statusChanged: false, reviewCount: 0 })
  mocks.save.mockResolvedValueOnce({ ok: true, data: saved })
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ finding: 'good', targetStatus: '', currentStatus: 'needs_repair', description: '' }))
})

test('AC-024.1.17: a pending save cannot duplicate, edit, reload, close, switch tabs or open another allocation', async () => {
  const actor = userEvent.setup(), saving = deferred<{ ok: true; data: ReturnType<typeof inspectionReceipt> }>()
  mocks.save.mockReturnValueOnce(saving.promise)
  render(page()); await openFirst(actor); await damage(actor)
  const save = screen.getByRole('button', { name: 'Save inspection' })
  await actor.dblClick(save)
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Saving inspection…' })).toBeDisabled()
  for (const label of ['Reload allocation', 'Close inspection', 'Refresh returns', 'Record inspection for P-25 (EVT-24)']) {
    expect(screen.getByRole('button', { name: label })).toBeDisabled()
  }
  expect(screen.getByLabelText('Findings / reason for status change', { exact: false })).toBeDisabled()
  expect(screen.getByLabelText('Inspection finding', { exact: false })).toBeDisabled()
  expect(screen.getByRole('tab', { name: 'Out (1)' })).toBeDisabled()
  await act(async () => saving.resolve({ ok: true, data: inspectionReceipt() }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Inspect equipment: P-24' })).not.toBeInTheDocument())
})

test('AC-024.1.18: stale or uncertain saves retain inputs and require explicit reload; failed/obsolete reloads stay locked', async () => {
  const actor = userEvent.setup()
  mocks.save.mockResolvedValueOnce({ ok: false, reason: messages.stale })
  render(page()); await openFirst(actor); await damage(actor)
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.stale)
  expect(mocks.load).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Findings / reason for status change', { exact: false })).toHaveValue('Cracked lens')
  expect(screen.getByRole('button', { name: 'Save inspection' })).toBeDisabled()
  mocks.load.mockResolvedValueOnce({ ok: false, reason: messages.load })
  await actor.click(screen.getByRole('button', { name: 'Reload allocation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.load)
  expect(screen.getByRole('button', { name: 'Save inspection' })).toBeDisabled()
  const fresh = { ...allocation, version: 'b'.repeat(32), operationalStatus: 'under_repair' as const, statusVersion: 1 }
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [fresh, anotherAllocation] }) })
  await actor.click(screen.getByRole('button', { name: 'Reload allocation' }))
  expect(await screen.findByText('Current status: Under Maintenance')).toBeInTheDocument()
  expect(screen.getByLabelText('Findings / reason for status change', { exact: false })).toHaveValue('Cracked lens')
  mocks.save.mockResolvedValueOnce({ ok: false, reason: messages.failed })
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ version: fresh.version, statusVersion: 1, targetStatus: 'needs_repair' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.failed)
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [anotherAllocation] }) })
  await actor.click(screen.getByRole('button', { name: 'Reload allocation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer pending inspection')
  expect(screen.getByLabelText('Findings / reason for status change', { exact: false })).toHaveValue('Cracked lens')
  expect(screen.getByRole('button', { name: 'Save inspection' })).toBeDisabled()
})

test('AC-024.2.8: confirmed saves close management and refresh partial/missing outcomes without losing history or other units', async () => {
  const actor = userEvent.setup()
  render(page()); await openFirst(actor); await damage(actor)
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [anotherAllocation], history: [inspection] }) })
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(await screen.findByText(/Inspection recorded.*1 reservation was flagged/)).toBeInTheDocument()
  expect(await screen.findByRole('tab', { name: 'Pending checks (1)' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Inspect equipment: P-24' })).not.toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Record inspection for P-25 (EVT-24)' }))
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'missing')
  await actor.type(screen.getByLabelText('Findings / reason for status change', { exact: false }), 'Not in returned case')
  const missing = { ...anotherAllocation, operationalStatus: 'unavailable' as const, statusVersion: 1,
    version: 'c'.repeat(32), lastFinding: 'missing' as const, lastInspectedAt: inspection.inspectedAt }
  mocks.save.mockResolvedValueOnce({ ok: true, data: inspectionReceipt({ allocationId: anotherAllocation.allocationId,
    finding: 'missing', resolved: false, status: 'unavailable', reviewCount: 0 }) })
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ pendingChecks: [missing] }) })
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  expect(await screen.findByText(/Missing report recorded; this unit remains pending inspection/)).toBeInTheDocument()
  expect(await screen.findByText('Missing reported · follow-up needed')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Record inspection for P-25 (EVT-24)' }))
  expect(screen.getByText('Current status: Unavailable')).toBeInTheDocument()
  await actor.selectOptions(screen.getByLabelText('Inspection finding', { exact: false }), 'good')
  expect(screen.getByRole('option', { name: 'Keep current status (Unavailable)' })).toBeInTheDocument()
})

test('AC-024.3.11: role/account changes unmount inspection and ignore late saves or old-account list responses', async () => {
  const actor = userEvent.setup(), saving = deferred<{ ok: true; data: ReturnType<typeof inspectionReceipt> }>()
  mocks.save.mockReturnValueOnce(saving.promise)
  const view = render(page())
  await openFirst(actor); await damage(actor)
  await actor.click(screen.getByRole('button', { name: 'Save inspection' }))
  view.rerender(page(current('coordinator')))
  await act(async () => saving.resolve({ ok: true, data: inspectionReceipt() }))
  expect(screen.queryByText(/Inspection recorded/)).not.toBeInTheDocument()
  expect(mocks.load).toHaveBeenCalledTimes(1)
  const late = deferred<{ ok: true; data: EquipmentReturns }>()
  mocks.load.mockReturnValueOnce(late.promise)
  view.rerender(page(current('tech_support', false, 'old-account')))
  mocks.load.mockResolvedValueOnce({ ok: true, data: returnsData({ out: [], pendingChecks: [], history: [] }) })
  view.rerender(page(current('tech_support', false, 'new-account')))
  expect(await screen.findByText('No equipment is pending inspection.')).toBeInTheDocument()
  await act(async () => late.resolve({ ok: true, data: returnsData() }))
  expect(screen.queryByText('P-24')).not.toBeInTheDocument()
})
