import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SlotPicker } from '../components/SlotPicker'

describe('AC-012.2 — continuous start/end selection', () => {
  test('AC-012.2.26: Full day chooses midnight to end of day, and unticking it clears the range', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SlotPicker id="slots" startTime="" endTime="" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith('00:00', '24:00')
    rerender(<SlotPicker id="slots" startTime="00:00" endTime="24:00" onChange={onChange} />)
    expect(screen.getByLabelText('Full day')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith('', '')
  })
  test('AC-012.2.27: a single quarter-hour can be chosen without Full day', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SlotPicker id="slots" startTime="" endTime="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Start time/), { target: { value: '09:00' } })
    expect(onChange).toHaveBeenLastCalledWith('09:00', '')
    rerender(<SlotPicker id="slots" startTime="09:00" endTime="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '09:15' } })
    expect(onChange).toHaveBeenLastCalledWith('09:00', '09:15')
    expect(screen.getByLabelText('Full day')).not.toBeChecked()
  })
})

test('AC-047.2.34: range controls cover midnight, lunch and end of day in quarter-hour increments and support disabled/error states', () => {
  const onChange = vi.fn()
  const { rerender } = render(<SlotPicker id="slots" startTime="00:00" endTime="12:15" onChange={onChange} />)
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  expect(screen.getByLabelText(/Start time/)).toHaveValue('00:00')
  expect(screen.getByLabelText(/End time/)).toHaveValue('12:15')
  fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '00:00' } })
  expect(onChange).toHaveBeenLastCalledWith('00:00', '00:00')
  fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '24:00' } })
  expect(onChange).toHaveBeenLastCalledWith('00:00', '24:00')
  expect(screen.getAllByRole('option', { name: '12:00' })).toHaveLength(2)
  expect(screen.queryByRole('option', { name: '12:05' })).not.toBeInTheDocument()
  rerender(<SlotPicker id="slots" startTime="" endTime="" onChange={onChange} disabled error="Choose a range" />)
  expect(screen.getByLabelText(/Start time/)).toBeDisabled()
  expect(screen.getByLabelText(/End time/)).toBeDisabled()
  expect(screen.getByLabelText('Full day')).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a range')
})
