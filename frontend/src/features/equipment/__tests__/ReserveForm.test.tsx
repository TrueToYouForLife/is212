import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ReserveForm } from '../components/ReserveForm'
import { RESERVE_FORM_MESSAGES as formMessages } from '../reservationRules'
import type { EquipmentType } from '../types'
import type { ReviewQueueItem } from '../reservationTypes'

const mocks = vi.hoisted(() => ({ reserve: vi.fn() }))
vi.mock('../reservationService', () => ({
  RESERVATION_MESSAGES: { saveFailed: 'Could not save.' },
  reserveRequirement: mocks.reserve,
}))

const catalogue: EquipmentType[] = [
  { id: 'projector', name: 'Projector', category: 'Visual' },
  { id: 'mic', name: 'Wireless mic', category: 'Audio' },
  { id: 'speaker', name: 'Speaker', category: 'Audio' },
]
// 00:30 SGT on 10 March to 17:00 SGT on 11 March.
const item: ReviewQueueItem = {
  requirementId: 'req-1', eventId: 'event-1', eventReference: 'EVT-2026-0001', eventName: 'Launch',
  eventStart: '2035-03-09T16:30:00Z', eventEnd: '2035-03-11T09:00:00Z', typeId: 'projector',
  typeName: 'Projector', quantityRequested: 2, technicalNotes: null, available: 3,
}
function setup(value: ReviewQueueItem = item) {
  const onReserved = vi.fn()
  render(<ReserveForm item={value} catalogue={catalogue} onReserved={onReserved} onCancel={vi.fn()} />)
  return { onReserved, user: userEvent.setup() }
}
async function setQuantity(user: ReturnType<typeof userEvent.setup>, quantity: string) {
  await user.clear(screen.getByLabelText('Quantity to reserve'))
  await user.type(screen.getByLabelText('Quantity to reserve'), quantity)
}

beforeEach(() => { vi.resetAllMocks() })

describe('AC-014.3: the reservation window', () => {
  test('AC-014.3.9: shows the window before saving', () => {
    setup()
    expect(screen.getByText('Collection 9 Mar 2035 · Return 11 Mar 2035')).toBeInTheDocument()
  })
})

describe('AC-014.4: the return date', () => {
  test("AC-014.4.9: pre-fills the return date with the event's last day", () => {
    setup()
    expect(screen.getByLabelText('Return date')).toHaveValue('2035-03-11')
  })
  test('AC-014.4.10: a return date before the last day shows an error and is not saved', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('Return date'))
    await user.type(screen.getByLabelText('Return date'), '2035-03-10')
    await user.click(screen.getByRole('button', { name: 'Reserve' }))
    expect(await screen.findByText(formMessages.returnBeforeLastDay)).toBeInTheDocument()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})

describe('AC-014.8: full or partial reservation', () => {
  test('AC-014.8.9: quantity must be a whole number from 0 to the requested quantity', async () => {
    const { user } = setup()
    for (const quantity of ['3', '1.5', '-1']) {
      await setQuantity(user, quantity)
      await user.click(screen.getByRole('button', { name: 'Reserve' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    }
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
})

describe('AC-014.9: shortfall and alternative', () => {
  const short: ReviewQueueItem = { ...item, available: 1 }
  test('AC-014.9.9: alternative fields appear only when there is a shortfall', async () => {
    const { user } = setup(short)
    await setQuantity(user, '2')
    expect(screen.queryByLabelText('Suggested alternative')).not.toBeInTheDocument()
    await setQuantity(user, '1')
    expect(screen.getByLabelText('Suggested alternative')).toBeInTheDocument()
    expect(screen.getByText('Shortfall: 1')).toBeInTheDocument()
  })
  test('AC-014.9.10: the alternative picker offers catalogue types except the requested one', async () => {
    const { user } = setup(short)
    await setQuantity(user, '1')
    const picker = screen.getByLabelText('Suggested alternative')
    expect(within(picker).getByRole('option', { name: 'Speaker' })).toBeInTheDocument()
    expect(within(picker).getByRole('option', { name: 'Wireless mic' })).toBeInTheDocument()
    expect(within(picker).queryByRole('option', { name: 'Projector' })).not.toBeInTheDocument()
  })
})
