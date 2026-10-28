import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RegistrationsCard } from '../components/RegistrationsCard'

/**
 * US54 AC-054.4 (SCRUM-246): the card that says how full an event is without saying who is
 * going.
 *
 * Who may learn either is settled by 0094 and 0114 and tested against real RLS in
 * event_registration_visibility.sql (AC-054.4.1 to .4.20). These check the courtesy layer:
 * the owner gets the route into the roll call, a colleague gets only the number, and a
 * count that could not be read says so rather than reading as zero.
 */

const mocks = vi.hoisted(() => ({ count: vi.fn() }))
vi.mock('../registrationCountService', () => ({
  loadRegistrationCount: (id: string) => mocks.count(id),
}))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

function renderCard(canOpenRollCall: boolean, eventId = EVENT) {
  return render(
    <MemoryRouter><RegistrationsCard eventId={eventId} canOpenRollCall={canOpenRollCall} /></MemoryRouter>,
  )
}

beforeEach(() => { mocks.count.mockReset().mockResolvedValue({ ok: true, count: 3 }) })

describe('AC-054.4 — someone who may read the roll call', () => {
  test('AC-054.4.22: the owner gets both the number and a route into the roll call', async () => {
    renderCard(true)

    expect(await screen.findByTestId('registration-count')).toHaveTextContent('3 registrations')
    expect(screen.getByRole('link', { name: 'Open registrations' }))
      .toHaveAttribute('href', `/requests/${EVENT}/registrations`)
  })

  // Reversed from its first version, which asserted the owner's count was NOT fetched on
  // the grounds that the roll call carries it. That left an Organiser looking at their own
  // event with no headcount unless they opened a second page. 0114's count predicate admits
  // the owner through can_view_event_registrations, so one fetch path serves both audiences.
  test('AC-054.4.23: the count is fetched for the owner too, not only for colleagues', async () => {
    renderCard(true)

    await screen.findByTestId('registration-count')
    expect(mocks.count).toHaveBeenCalledWith(EVENT)
  })
})

describe('AC-054.4 — someone who may not', () => {
  test('AC-054.4.24: a colleague is shown the number and no route into the roll call', async () => {
    renderCard(false)

    expect(await screen.findByTestId('registration-count')).toHaveTextContent('3 registrations')
    // The only difference ownership makes on this card.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(mocks.count).toHaveBeenCalledWith(EVENT)
  })

  test('AC-054.4.25: one registration reads in the singular', async () => {
    mocks.count.mockResolvedValue({ ok: true, count: 1 })
    renderCard(false)

    expect(await screen.findByTestId('registration-count')).toHaveTextContent('1 registration')
  })

  test('AC-054.4.26: an event nobody has registered for reads as zero', async () => {
    // Boundary. 0114 returns 0 both for an empty event and for a caller who may not look,
    // deliberately, so the difference cannot be used to discover an event exists. The card
    // shows the number it was given either way.
    mocks.count.mockResolvedValue({ ok: true, count: 0 })
    renderCard(false)

    expect(await screen.findByTestId('registration-count')).toHaveTextContent('0 registrations')
  })

  test('AC-054.4.27: a count that could not be read says so, not zero', async () => {
    // "0 registrations" after a failed read is a confident wrong answer, and the one a
    // colleague would plan around.
    mocks.count.mockResolvedValue({ ok: false })
    renderCard(false)

    expect(await screen.findByText('Registration count unavailable.')).toBeInTheDocument()
    expect(screen.queryByTestId('registration-count')).not.toBeInTheDocument()
  })

  test('AC-054.4.28: a thrown read is reported the same way', async () => {
    mocks.count.mockRejectedValue(new Error('network'))
    renderCard(false)

    expect(await screen.findByText('Registration count unavailable.')).toBeInTheDocument()
  })

  test('AC-054.4.29: the count is asked for once, and only for the event shown', async () => {
    renderCard(false)

    await screen.findByTestId('registration-count')
    await waitFor(() => expect(mocks.count).toHaveBeenCalledTimes(1))
    expect(mocks.count).toHaveBeenCalledWith(EVENT)
  })
})