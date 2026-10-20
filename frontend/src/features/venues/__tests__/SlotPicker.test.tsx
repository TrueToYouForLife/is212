import { BLOCK_SLOTS } from '../venueBlockValidation'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { SlotPicker } from '../components/SlotPicker'
import { SLOT_LABELS } from '../slotFormat'

describe('AC-012.2 — one or more slots', () => {
  test('AC-012.2.26: Full day chooses all 96 slots, and unticking it clears them', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SlotPicker id="slots" value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith([...BLOCK_SLOTS])

    rerender(<SlotPicker id="slots" value={[...BLOCK_SLOTS]} onChange={onChange} />)
    expect(screen.getByLabelText('Full day')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Full day'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  test('AC-012.2.27: a single slot can be added on its own, without ticking Full day', () => {
    const onChange = vi.fn()
    render(<SlotPicker id="slots" value={['T0900']} onChange={onChange} />)

    expect(screen.getByLabelText('Full day')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText(SLOT_LABELS.T2345))
    expect(onChange).toHaveBeenLastCalledWith(['T0900', 'T2345'])
  })
})

test('AC-047.2.34: picker covers midnight, lunch and end of day, supports deselection and disables every choice', () => {
  const onChange = vi.fn()
  const { rerender } = render(<SlotPicker id="slots" value={['T0000', 'T1200']} onChange={onChange} />)
  expect(screen.getAllByRole('checkbox')).toHaveLength(97)
  expect(screen.getByLabelText('00:00–00:15')).toBeChecked()
  expect(screen.getByLabelText('12:00–12:15')).toBeChecked()
  fireEvent.click(screen.getByLabelText('00:00–00:15'))
  expect(onChange).toHaveBeenLastCalledWith(['T1200'])
  fireEvent.click(screen.getByLabelText('23:45–24:00'))
  expect(onChange).toHaveBeenLastCalledWith(['T0000', 'T1200', 'T2345'])
  rerender(<SlotPicker id="slots" value={[]} onChange={onChange} disabled error="Choose a slot" />)
  expect(screen.getAllByRole('checkbox').every((checkbox) => (checkbox as HTMLInputElement).disabled)).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a slot')
})
