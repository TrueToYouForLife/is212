import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EquipmentRequirementsEditor } from '../components/EquipmentRequirementsEditor'
import { REQUIREMENT_MESSAGES } from '../validation'
import type { EquipmentRequirement, EquipmentType, EventRequirements, Viewer } from '../types'

const messages = vi.hoisted(() => ({
  forbidden: 'Only the assigned Event Coordinator can change equipment requirements.',
  notEligible: 'Equipment requirements can only be changed for approved events.',
  typeMissing: 'That equipment type is no longer in the catalogue.',
  loadFailed: 'Equipment requirements could not be loaded.',
  catalogueFailed: 'The equipment catalogue could not be loaded.',
  notificationsFailed: 'Equipment notifications could not be loaded.',
  saveFailed: 'The change could not be confirmed.',
}))
const mocks = vi.hoisted(() => ({
  load: vi.fn(), catalogue: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn(),
}))
vi.mock('../equipmentRequirementService', () => ({
  EQUIPMENT_SERVICE_MESSAGES: messages,
  loadEventRequirements: mocks.load, loadCatalogue: mocks.catalogue,
  addRequirement: mocks.add, updateRequirement: mocks.update, removeRequirement: mocks.remove,
}))

const coordinator: Viewer = { id: 'coordinator-1', role: 'coordinator' }
const catalogue: EquipmentType[] = [
  { id: 'mic', name: 'Wireless mic', category: 'Audio' },
  { id: 'projector', name: 'Projector', category: 'Visual' },
]
const line: EquipmentRequirement = {
  id: 'req-1', eventId: 'event-1', typeId: 'projector', typeName: 'Projector', quantity: 2,
  technicalNotes: null, essential: true, status: 'pending_review', displayStatus: 'pending_review',
}
const reservedLine: EquipmentRequirement = { ...line, status: 'reserved', displayStatus: 'reserved' }
function context(requirements: EquipmentRequirement[] = [], organiserEquipment: string | null = '2 projectors, 4 mics'): EventRequirements {
  return {
    event: {
      id: 'event-1', reference: 'EVT-2026-0001', name: 'Launch', status: 'approved',
      coordinatorId: 'coordinator-1', organiserEquipment,
    },
    requirements,
  }
}
function setup(data: EventRequirements = context(), viewer: Viewer = coordinator) {
  mocks.load.mockResolvedValue({ ok: true, data })
  return { ...render(<EquipmentRequirementsEditor eventId="event-1" viewer={viewer} />), user: userEvent.setup() }
}
async function fillForm(user: ReturnType<typeof userEvent.setup>, typeName: string, quantity: string) {
  await user.selectOptions(await screen.findByLabelText('Equipment type'), typeName)
  await user.clear(screen.getByLabelText('Quantity'))
  await user.type(screen.getByLabelText('Quantity'), quantity)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.catalogue.mockResolvedValue({ ok: true, data: catalogue })
})

describe('AC-013.1: assigned-coordinator editing with the organiser request shown', () => {
  test("AC-013.1.9: shows the organiser's original equipment request next to the requirements", async () => {
    setup(context([line]))
    expect(await screen.findByRole('heading', { name: "Organiser's equipment request" })).toBeInTheDocument()
    expect(screen.getByText('2 projectors, 4 mics')).toBeInTheDocument()
    // Scoped to the list: the catalogue picker also offers "Projector".
    expect(within(screen.getByRole('list', { name: 'Equipment requirements' })).getByText('Projector')).toBeInTheDocument()
  })
  test('AC-013.1.10: says so when the organiser listed no equipment', async () => {
    const { unmount } = setup(context([], null))
    expect(await screen.findByText('The organiser did not list any equipment.')).toBeInTheDocument()
    unmount()
    setup(context([], '   '))
    expect(await screen.findByText('The organiser did not list any equipment.')).toBeInTheDocument()
  })
  test('AC-013.1.11: viewers who may not write see the lines without write controls', async () => {
    for (const viewer of [{ id: 'tech-1', role: 'tech_support' }, { id: 'coordinator-2', role: 'coordinator' }] as Viewer[]) {
      const { unmount } = setup(context([line]), viewer)
      expect(await screen.findByText('Projector')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /add requirement|edit|remove/i })).not.toBeInTheDocument()
      unmount()
    }
  })
})

describe('AC-013.2: catalogue picker and quantity validation', () => {
  test('AC-013.2.16: the type picker offers only catalogue types', async () => {
    setup()
    const picker = await screen.findByLabelText('Equipment type')
    expect(picker.tagName).toBe('SELECT')
    expect(await screen.findByRole('option', { name: 'Projector' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Wireless mic' })).toBeInTheDocument()
  })
  test('AC-013.2.17: quantity 0 shows an error and is not saved', async () => {
    const { user } = setup()
    await fillForm(user, 'Projector', '0')
    await user.click(screen.getByRole('button', { name: 'Add requirement' }))
    expect(await screen.findByText(REQUIREMENT_MESSAGES.quantityMin)).toBeInTheDocument()
    expect(mocks.add).not.toHaveBeenCalled()
  })
  test('AC-013.2.18: an empty catalogue explains why nothing can be added', async () => {
    mocks.catalogue.mockResolvedValue({ ok: true, data: [] })
    setup()
    expect(await screen.findByText('No equipment types in the catalogue yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add requirement' })).toBeDisabled()
  })
  test('AC-013.2.19: a catalogue that fails to load shows an error and blocks adding', async () => {
    mocks.catalogue.mockResolvedValue({ ok: false, reason: messages.catalogueFailed })
    setup()
    expect(await screen.findByText(messages.catalogueFailed)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add requirement' })).toBeDisabled()
  })
})

describe('AC-013.3: each line shows its status', () => {
  test('AC-013.3.9: every line shows its own status', async () => {
    const statuses = [
      ['pending_review', 'pending_review', true], ['reserved', 'reserved', true],
      ['partially_reserved', 'partially_reserved', true], ['unavailable', 'unavailable', true],
      ['pending_review', 'non_essential', false],
    ] as const
    setup(context(statuses.map(([status, displayStatus, essential], index) => ({
      ...line, id: `req-${index}`, typeName: `Item ${index}`, status, displayStatus, essential,
    }))))
    for (const label of ['Pending review', 'Reserved', 'Partially reserved', 'Unavailable', 'Non-essential']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
  })
  test('AC-013.3.10: says so when nothing has been recorded', async () => {
    setup(context([]))
    expect(await screen.findByText('No equipment requirements recorded yet.')).toBeInTheDocument()
  })
  test('AC-013.3.11: the coordinator can mark a line non-essential', async () => {
    mocks.add.mockResolvedValue({ ok: true, data: { ...line, typeId: 'mic', typeName: 'Wireless mic', essential: false, displayStatus: 'non_essential' } })
    const { user } = setup()
    await fillForm(user, 'Wireless mic', '1')
    await user.click(screen.getByLabelText('Essential'))
    await user.click(screen.getByRole('button', { name: 'Add requirement' }))
    expect(mocks.add).toHaveBeenCalledTimes(1)
    expect(mocks.add.mock.calls[0][0]).toBe('event-1')
    expect(mocks.add.mock.calls[0][1]).toMatchObject({ typeId: 'mic', essential: false })
  })
})

describe('AC-013.5: recording does not reserve', () => {
  test('AC-013.5.2: a newly added line shows pending review, never reserved', async () => {
    mocks.add.mockResolvedValue({ ok: true, data: line })
    const { user } = setup(context([]))
    await fillForm(user, 'Projector', '2')
    await user.click(screen.getByRole('button', { name: 'Add requirement' }))
    expect(await screen.findByText('Pending review')).toBeInTheDocument()
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument()
  })
})

describe('AC-013.6: changing or removing a reserved line', () => {
  const warning = 'Saving returns this line to pending review and releases its reserved equipment.'
  test('AC-013.6.7: warns before a reserved line changes type or quantity', async () => {
    const { user } = setup(context([reservedLine]))
    await user.click(await screen.findByRole('button', { name: 'Edit Projector' }))
    expect(screen.queryByText(warning)).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '3')
    expect(screen.getByText(warning)).toBeInTheDocument()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  test('AC-013.6.8: removing a reserved line asks for confirmation that mentions the release', async () => {
    mocks.remove.mockResolvedValue({ ok: true, data: null })
    const { user } = setup(context([reservedLine]))
    await user.click(await screen.findByRole('button', { name: 'Remove Projector' }))
    expect(screen.getByText(/releases its reserved equipment/)).toBeInTheDocument()
    expect(mocks.remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm removal' }))
    expect(mocks.remove).toHaveBeenCalledWith('req-1')
  })
  test('AC-013.6.9: after saving, the changed line shows pending review', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: { ...line, quantity: 3 } })
    const { user } = setup(context([reservedLine]))
    await user.click(await screen.findByRole('button', { name: 'Edit Projector' }))
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '3')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Pending review')).toBeInTheDocument()
    expect(screen.queryByText('Reserved')).not.toBeInTheDocument()
    expect(mocks.update).toHaveBeenCalledWith('req-1', expect.objectContaining({ typeId: 'projector' }), catalogue)
  })
})
