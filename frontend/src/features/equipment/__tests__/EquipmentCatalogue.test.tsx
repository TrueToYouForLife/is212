import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EquipmentCataloguePage } from '../pages/EquipmentCataloguePage'
import { EquipmentCatalogueView } from '../components/EquipmentCatalogueView'
import { TopNav } from '../../../components/layout/TopNav'
import { SessionContext, type CurrentUser } from '../../auth/sessionContext'
import { USER_ROLES, type UserRole } from '../../auth/types'
import type { EquipmentCatalogue } from '../equipmentCatalogueService'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../equipmentCatalogueService', () => ({ loadEquipmentCatalogue: mocks.load }))
vi.mock('../../notifications/useUnreadNotificationCount', () => ({ useUnreadNotificationCount: () => 0 }))
const data: EquipmentCatalogue = {
  types: [
    { id: 'projector', name: 'Projector', category: 'Video', description: 'HDMI projector', totalUnits: 5, usableUnits: 1 },
    { id: 'mic', name: 'Microphone', category: 'Audio', description: null, totalUnits: 1, usableUnits: 1 },
    { id: 'speaker', name: 'Speaker', category: 'Audio', description: null, totalUnits: 0, usableUnits: 0 },
  ],
  units: [
    ...(['operational', 'needs_repair', 'under_repair', 'retired', 'missing'] as const).map((status, index) => ({
      id: `p${index}`, assetTag: `P-${index}`, typeId: 'projector', status,
      locationId: index === 0 ? 'hall' : 'store', locationName: index === 0 ? 'Hall' : 'Store', locationDescription: 'Level 1',
    })),
    { id: 'm1', assetTag: 'M-1', typeId: 'mic', status: 'operational', locationId: 'store', locationName: 'Store', locationDescription: 'Level 1' },
  ],
}
beforeEach(() => { vi.resetAllMocks(); mocks.load.mockResolvedValue({ ok: true, data }) })
function user(role: UserRole | null, loading = false): CurrentUser {
  return { profile: role ? { id: role, fullName: 'Fixture', role } : null, session: null, loading, refresh: vi.fn() }
}

test('AC-027.1.4: displays unit details and every existing status without catalogue mutation controls', async () => {
  render(<EquipmentCatalogueView />)
  const table = await screen.findByRole('table', { name: 'Equipment units' })
  expect(within(table).getAllByRole('row')).toHaveLength(7)
  for (const text of ['P-0', 'HDMI projector', 'Hall — Level 1', 'Operational', 'Damaged', 'Under Maintenance', 'Unavailable (retired)', 'Unavailable (missing)', 'No description recorded']) {
    expect(within(table).getAllByText(text).length).toBeGreaterThan(0)
  }
  expect(screen.queryByRole('button', { name: /add|delete|edit|change status/i })).not.toBeInTheDocument()
})

test('AC-027.2.2: displays global usable and total counts, including an equipment type with zero units', async () => {
  render(<EquipmentCatalogueView />)
  const totals = await screen.findByRole('region', { name: 'Equipment stock totals' })
  for (const text of ['1 usable / 5 total units', '1 usable / 1 total units', '0 usable / 0 total units']) {
    expect(within(totals).getByText(text)).toBeInTheDocument()
  }
})

test('AC-027.3.1: type, location and status filters intersect; unavailable includes retired/missing; reset restores all units', async () => {
  const actor = userEvent.setup()
  render(<EquipmentCatalogueView />)
  await screen.findByRole('table')
  await actor.selectOptions(screen.getByLabelText('Equipment type'), 'projector')
  await actor.selectOptions(screen.getByLabelText('Location'), 'store')
  await actor.selectOptions(screen.getByLabelText('Operational status'), 'Unavailable')
  expect(screen.getByText('2 equipment units shown')).toBeInTheDocument()
  expect(screen.getByText('P-3')).toBeInTheDocument()
  expect(screen.getByText('P-4')).toBeInTheDocument()
  expect(screen.queryByText('M-1')).not.toBeInTheDocument()
  expect(screen.getByText('1 usable / 5 total units')).toBeInTheDocument()
  await actor.selectOptions(screen.getByLabelText('Operational status'), 'Operational')
  expect(screen.getByText('No equipment units match these filters.')).toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(screen.getByText('6 equipment units shown')).toBeInTheDocument()
  for (const status of ['Damaged', 'Under Maintenance']) {
    await actor.selectOptions(screen.getByLabelText('Operational status'), status)
    expect(screen.getByText('1 equipment unit shown')).toBeInTheDocument()
  }
})

test('AC-027.1.5: empty catalogue, load failure and retry have distinct states; refresh removes obsolete rows', async () => {
  const actor = userEvent.setup()
  mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Could not load catalogue.' })
  render(<EquipmentCatalogueView />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load catalogue.')
  expect(screen.queryByText('No equipment units in the catalogue.')).not.toBeInTheDocument()
  await actor.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table')
  mocks.load.mockResolvedValueOnce({ ok: true, data: { types: [], units: [] } })
  await actor.click(screen.getByRole('button', { name: 'Refresh catalogue' }))
  expect(await screen.findByText('No equipment units in the catalogue.')).toBeInTheDocument()
  expect(screen.getByText('No equipment types in the catalogue.')).toBeInTheDocument()
  expect(screen.queryByText('P-0')).not.toBeInTheDocument()
})

test('AC-027.4.2: only Coordinators and Technical Support receive catalogue navigation and load the page', async () => {
  for (const role of [...USER_ROLES, null]) {
    mocks.load.mockClear()
    const context = user(role)
    const view = render(<MemoryRouter><SessionContext.Provider value={context}>
      <TopNav session={null} profile={context.profile} loading={false} /><EquipmentCataloguePage />
    </SessionContext.Provider></MemoryRouter>)
    if (role === 'coordinator' || role === 'tech_support') {
      expect(screen.getByRole('link', { name: 'Equipment catalogue' })).toHaveAttribute('href', '/equipment/catalogue')
      await screen.findByRole('table')
      expect(mocks.load).toHaveBeenCalledTimes(1)
    } else {
      expect(screen.queryByRole('link', { name: 'Equipment catalogue' })).not.toBeInTheDocument()
      expect(mocks.load).not.toHaveBeenCalled()
    }
    view.unmount()
  }
})

test('AC-027.4.3: auth loading does not fetch data; losing the permitted role hides a late catalogue response', async () => {
  const view = render(<SessionContext.Provider value={user(null, true)}><EquipmentCataloguePage /></SessionContext.Provider>)
  expect(mocks.load).not.toHaveBeenCalled()
  let finish!: (value: { ok: true; data: EquipmentCatalogue }) => void
  mocks.load.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  view.rerender(<SessionContext.Provider value={user('coordinator')}><EquipmentCataloguePage /></SessionContext.Provider>)
  await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1))
  view.rerender(<SessionContext.Provider value={user('organiser')}><EquipmentCataloguePage /></SessionContext.Provider>)
  finish({ ok: true, data })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
