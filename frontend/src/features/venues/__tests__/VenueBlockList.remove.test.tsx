import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueBlockList } from '../components/VenueBlockList'
import type { VenueBlock } from '../venueBlockTypes'

const BLOCK: VenueBlock = {
  id: 'block-1',
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-12',
  slots: ['T0900', 'T1300', 'T2345'],
  reason: 'Ceiling repair',
  createdByName: 'Vera Venue',
  createdAt: '2039-12-05T02:00:00+00:00',
}

describe('AC-012.9 — current blocks can be removed', () => {
  test('AC-012.9.19: Remove asks for confirmation, and nothing is removed until it is given', () => {
    const onRemove = vi.fn()
    render(<VenueBlockList blocks={[BLOCK]} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText(/Remove this block\?/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Remove this block\?/)).toBeNull()
    expect(onRemove).not.toHaveBeenCalled()
  })

  test('AC-012.9.20: confirming removes the block and tells the page to reload its list', async () => {
    const onRemove = vi.fn().mockResolvedValue({ ok: true, value: null })
    const onRemoved = vi.fn()
    render(<VenueBlockList blocks={[BLOCK]} onRemove={onRemove} onRemoved={onRemoved} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(onRemove).toHaveBeenCalledWith('block-1')
    await waitFor(() => expect(onRemoved).toHaveBeenCalled())
  })

  test('AC-012.9.21: a removal that fails says why, and the block stays listed', async () => {
    const onRemove = vi.fn().mockResolvedValue({
      ok: false,
      reason: 'That block or venue no longer exists. Reload the page to see the current blocks.',
    })
    render(<VenueBlockList blocks={[BLOCK]} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That block or venue no longer exists')
    expect(screen.getByText('Ceiling repair')).toBeInTheDocument()
  })
})
