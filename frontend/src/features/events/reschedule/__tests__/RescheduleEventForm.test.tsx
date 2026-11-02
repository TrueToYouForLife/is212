import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RescheduleEventForm } from '../RescheduleEventForm'

const mocks = vi.hoisted(() => ({ reschedule: vi.fn() }))
vi.mock('../rescheduleService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../rescheduleService')>()),
  rescheduleEvent: mocks.reschedule,
}))

function renderForm() {
  const onRescheduled = vi.fn()
  render(<RescheduleEventForm eventId="e-1" onRescheduled={onRescheduled} />)
  return onRescheduled
}

function fill(start: string, end: string, reason = '') {
  fireEvent.change(screen.getByLabelText('New start'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('New end'), { target: { value: end } })
  fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: reason } })
}

async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Reschedule event|Rescheduling/ })) })
}

beforeEach(() => mocks.reschedule.mockReset())

describe('AC-021.1 — the Coordinator reschedules from the event page', () => {
  test('AC-021.1.12: nothing is sent until both times are chosen and the end is after the start', async () => {
    renderForm()
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the new start and end.')
    fill('2047-06-12T19:00', '2047-06-12T18:00')
    await submit()
    expect(screen.getByRole('alert')).toHaveTextContent('The new end must be after the new start.')
    expect(mocks.reschedule).not.toHaveBeenCalled()
  })
})

describe('AC-021.4 — the new date is set', () => {
  test('AC-021.4.2: the chosen local times are sent as instants with the reason; afterwards the page refreshes and the form clears', async () => {
    mocks.reschedule.mockResolvedValue({ ok: true, status: 'planning' })
    const onRescheduled = renderForm()
    fill('2047-06-12T19:00', '2047-06-12T22:00', 'Headliner delayed')
    await submit()
    expect(mocks.reschedule).toHaveBeenCalledWith('e-1', new Date('2047-06-12T19:00').toISOString(),
      new Date('2047-06-12T22:00').toISOString(), 'Headliner delayed')
    expect(onRescheduled).toHaveBeenCalledWith('planning')
    expect(screen.getByLabelText('New start')).toHaveValue('')
  })

  test('AC-021.4.3: while saving the button waits; a refusal is shown and nothing is reported as rescheduled', async () => {
    // The save answers after a short delay, so the waiting state can be seen first.
    mocks.reschedule.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, reason: 'The new date must be in the future' }), 20)
    }))
    const onRescheduled = renderForm()
    fill('2020-01-01T10:00', '2020-01-01T12:00')
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule event' }))
    expect(screen.getByRole('button', { name: 'Rescheduling…' })).toBeDisabled()
    expect(await screen.findByRole('alert')).toHaveTextContent('The new date must be in the future')
    expect(onRescheduled).not.toHaveBeenCalled()
  })
})
