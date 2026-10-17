import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EventWaitlistPanel } from '../components/EventWaitlistPanel'
import type { ManagedWaitlistEntry } from '../types'

/** US16 SCRUM-154: the assigned Coordinator's waiting-list screen. */
const mocks = vi.hoisted(() => ({ load: vi.fn(), move: vi.fn() }))
vi.mock('../waitlistManagementService', () => ({
  loadEventWaitlist: mocks.load, moveWaitlistEntry: mocks.move,
}))

const waiting = (entryId: string, attendeeName: string, position: number): ManagedWaitlistEntry => ({
  entryId, attendeeName, status: 'waiting', position, joinedAt: '2035-04-01T01:00:00Z', offerExpiresAt: null,
})
const queue = [waiting('e1', 'Ben Two', 1), waiting('e2', 'Dee Four', 2), waiting('e3', 'Eli Five', 3)]
const button = (label: string, name: string) => screen.getByRole('button', { name: `${label}: ${name}` })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.load.mockResolvedValue({ ok: true, value: queue })
  mocks.move.mockResolvedValue({ ok: true })
})

describe('AC-016.2: the Coordinator reads and reorders the waiting list', () => {
  test('AC-016.2.37: shows each person in order with their position', async () => {
    render(<EventWaitlistPanel eventId="event-1" />)
    expect(await screen.findByText('Ben Two')).toBeInTheDocument()
    expect(screen.getByText(/Position 1/)).toBeInTheDocument()
    expect(screen.getByText(/Position 3/)).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledWith('event-1')
  })

  test('AC-016.2.38: the first person cannot move to the front or up, and the last cannot move down', async () => {
    render(<EventWaitlistPanel eventId="event-1" />)
    await screen.findByText('Ben Two')
    expect(button('Move to front', 'Ben Two')).toBeDisabled()
    expect(button('Move up', 'Ben Two')).toBeDisabled()
    expect(button('Move down', 'Ben Two')).toBeEnabled()
    expect(button('Move down', 'Eli Five')).toBeDisabled()
    expect(button('Move to front', 'Eli Five')).toBeEnabled()
  })

  test('AC-016.2.39: clicking a move sends that entry and direction, then reloads the list', async () => {
    render(<EventWaitlistPanel eventId="event-1" />)
    await screen.findByText('Ben Two')
    fireEvent.click(button('Move to front', 'Dee Four'))
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
    expect(mocks.move).toHaveBeenCalledWith('e2', 'front')
  })

  test('AC-016.2.40: if the list was out of date, the reason is shown and the list reloads', async () => {
    mocks.move.mockResolvedValue({ ok: false, stale: true, reason: 'That person is no longer waiting.' })
    render(<EventWaitlistPanel eventId="event-1" />)
    await screen.findByText('Ben Two')
    fireEvent.click(button('Move up', 'Dee Four'))
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer waiting')
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
  })

  test('AC-016.2.41: a failure that can be retried is shown without reloading the list', async () => {
    mocks.move.mockResolvedValue({ ok: false, stale: false, reason: 'The waiting list could not be reordered.' })
    render(<EventWaitlistPanel eventId="event-1" />)
    await screen.findByText('Ben Two')
    fireEvent.click(button('Move up', 'Dee Four'))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reordered')
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })

  test('AC-016.2.42: a second click while a move is being saved sends nothing more', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    mocks.move.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<EventWaitlistPanel eventId="event-1" />)
    await screen.findByText('Ben Two')
    fireEvent.click(button('Move up', 'Dee Four'))
    fireEvent.click(button('Move down', 'Dee Four'))
    expect(mocks.move).toHaveBeenCalledTimes(1)
    finish({ ok: true })
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
  })

  test('AC-016.2.43: an empty list says so, and a failed load is shown with a retry', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [] })
    const { unmount } = render(<EventWaitlistPanel eventId="event-1" />)
    expect(await screen.findByText('No one is on the waiting list.')).toBeInTheDocument()
    unmount()

    mocks.load.mockResolvedValue({ ok: false, reason: 'The waiting list could not be loaded.' })
    render(<EventWaitlistPanel eventId="event-1" />)
    expect(await screen.findByText('The waiting list could not be loaded.')).toBeInTheDocument()
  })
})

describe('AC-016.3: a held place', () => {
  test('AC-016.3.28: someone holding an offered place is shown with their deadline and no move buttons', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [
      { entryId: 'held', attendeeName: 'Cal Three', status: 'offered', position: null,
        joinedAt: '2035-04-01T01:00:00Z', offerExpiresAt: '2035-04-04T01:00:00Z' },
      waiting('e1', 'Ben Two', 1),
    ] })
    render(<EventWaitlistPanel eventId="event-1" />)
    expect(await screen.findByText('Cal Three')).toBeInTheDocument()
    expect(screen.getByText(/offered a place until/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /: Cal Three$/ })).not.toBeInTheDocument()
    expect(button('Move down', 'Ben Two')).toBeDisabled()
  })
})

describe('AC-016.4: a lapsed offer', () => {
  test('AC-016.4.18: an offer that has expired is shown as expired, with no move buttons', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [
      { entryId: 'lapsed', attendeeName: 'Cal Three', status: 'expired', position: null,
        joinedAt: '2035-04-01T01:00:00Z', offerExpiresAt: '2035-04-04T01:00:00Z' },
    ] })
    render(<EventWaitlistPanel eventId="event-1" />)
    expect(await screen.findByText(/offer expired/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cal Three$/ })).not.toBeInTheDocument()
  })
})
