import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueForm } from '../components/VenueForm'
import { VENUE_FORM_MESSAGES as messages } from '../venueManagementValidation'

const LAYOUTS = [
  { code: 'theatre', label: 'Theatre' },
  { code: 'classroom', label: 'Classroom' },
]

function renderForm({ serverError = null as string | null, submitting = false } = {}) {
  const onSubmit = vi.fn()
  render(
    <VenueForm
      layoutOptions={LAYOUTS}
      onSubmit={onSubmit}
      submitting={submitting}
      serverError={serverError}
      submitLabel="Add venue"
    />,
  )
  return onSubmit
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('AC-046.1 — Venue Staff can add a venue with its details', () => {
  test('AC-046.1.20: filling in every detail submits the venue', () => {
    const onSubmit = renderForm()
    type(/^Venue name/, 'Grand Hall')
    type(/^Location/, 'Level 1')
    type('Opens at', '07:00')
    type('Closes at', '18:00')
    type('Layout 1', 'theatre')
    type('Capacity for layout 1', '120')
    fireEvent.click(screen.getByRole('button', { name: 'Add another layout' }))
    type('Layout 2', 'classroom')
    type('Capacity for layout 2', '60')
    fireEvent.click(screen.getByLabelText('Projector'))
    fireEvent.click(screen.getByLabelText('Wi-Fi'))
    fireEvent.click(screen.getByLabelText('Wi-Fi'))
    fireEvent.click(screen.getByLabelText('Wheelchair access'))
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Grand Hall',
      location: 'Level 1',
      opensAt: '07:00',
      closesAt: '18:00',
      accessibility: ['wheelchair_access'],
      facilities: ['projector'],
      layouts: [{ layout: 'theatre', capacity: 120 }, { layout: 'classroom', capacity: 60 }],
    })
  })

  test('AC-046.1.21: opening and closing times can only be chosen on slot boundaries', () => {
    renderForm()
    const optionsOf = (label: string) =>
      Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.value)
    expect(optionsOf('Opens at')).toEqual(['', '07:00', '13:00', '19:00'])
    expect(optionsOf('Closes at')).toEqual(['', '12:00', '18:00', '24:00'])
  })

  test('AC-046.1.22: problems are shown next to their fields, and nothing is submitted', () => {
    const onSubmit = renderForm()
    type('Opens at', '13:00')
    type('Closes at', '12:00')
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(messages.nameRequired)).toBeInTheDocument()
    expect(screen.getByText(messages.locationRequired)).toBeInTheDocument()
    expect(screen.getByText(messages.hoursOrder)).toBeInTheDocument()
    expect(screen.getByText(messages.layoutRequired)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Venue name/)).toHaveAttribute('aria-invalid', 'true')
  })

  test('AC-046.1.23: a refusal from the database is shown, and the button is disabled while saving', () => {
    renderForm({ serverError: 'Another venue already has this name. Choose a different name.', submitting: true })
    expect(screen.getByRole('alert')).toHaveTextContent('Another venue already has this name.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})

describe('AC-046.3 — every supported layout has a capacity of at least 1', () => {
  test('AC-046.3.9: an invalid capacity is flagged on its own row', () => {
    const onSubmit = renderForm()
    type(/^Venue name/, 'Grand Hall')
    type(/^Location/, 'Level 1')
    type('Opens at', '07:00')
    type('Closes at', '12:00')
    type('Layout 1', 'theatre')
    type('Capacity for layout 1', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Add venue' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(messages.capacityInvalid)).toBeInTheDocument()
    expect(screen.getByLabelText('Capacity for layout 1')).toHaveAttribute('aria-invalid', 'true')
  })

  test('AC-046.3.10: the last layout cannot be removed, and no more rows than layouts can be added', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Remove layout 1' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Add another layout' }))
    expect(screen.getByRole('button', { name: 'Add another layout' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove layout 1' })).toBeEnabled()

    type('Layout 2', 'classroom')
    fireEvent.click(screen.getByRole('button', { name: 'Remove layout 1' }))
    expect(screen.queryByLabelText('Layout 2')).toBeNull()
    expect(screen.getByLabelText('Layout 1')).toHaveValue('classroom')
  })
})
