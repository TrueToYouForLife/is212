import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { RetireVenuePanel } from '../components/RetireVenuePanel'
import { RETIREMENT_MESSAGES } from '../venueManagementValidation'

function renderPanel(submitting = false) {
  const onRetire = vi.fn()
  render(<RetireVenuePanel venueName="Grand Hall" onRetire={onRetire} submitting={submitting} />)
  return onRetire
}

describe('AC-046.5 — Venue Staff can retire a venue', () => {
  test('AC-046.5.18: retiring asks for a reason before anything else', () => {
    const onRetire = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Retire venue…' }))
    expect(screen.getByText(RETIREMENT_MESSAGES.noteRequired)).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onRetire).not.toHaveBeenCalled()
  })

  test('AC-046.5.19: with a reason, retiring needs a second, explicit confirmation; cancelling goes back', () => {
    const onRetire = renderPanel()
    fireEvent.change(screen.getByLabelText('Why is it being retired?'), { target: { value: 'Building closes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retire venue…' }))
    expect(screen.getByRole('alertdialog', { name: 'Confirm retirement' })).toHaveTextContent('Retire Grand Hall?')
    expect(onRetire).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByLabelText('Why is it being retired?')).toHaveValue('Building closes')
  })

  test('AC-046.5.20: confirming retires the venue with the reason, trimmed', () => {
    const onRetire = renderPanel()
    fireEvent.change(screen.getByLabelText('Why is it being retired?'), { target: { value: '  Building closes  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retire venue…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm retirement' }))
    expect(onRetire).toHaveBeenCalledWith('Building closes')
  })

  test('AC-046.5.21: while retiring, neither confirming again nor cancelling is possible', () => {
    renderPanel(true)
    fireEvent.change(screen.getByLabelText('Why is it being retired?'), { target: { value: 'Closing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retire venue…' }))
    expect(screen.getByRole('button', { name: 'Retiring…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
