import { beforeEach, expect, test, vi } from 'vitest'
import { loadSpaceLayouts } from '../bookingSpaceService'

const query = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: query.from } }))
beforeEach(() => {
  vi.resetAllMocks()
  query.from.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
})

test('AC-049.2.35: loads the selected venue layouts in layout order', async () => {
  const layouts = [{ layout: 'theatre', capacity: 50 }]
  query.order.mockResolvedValue({ data: layouts, error: null })
  await expect(loadSpaceLayouts('venue-one')).resolves.toEqual(layouts)
  expect(query.from).toHaveBeenCalledWith('venue_layouts')
  expect(query.select).toHaveBeenCalledWith('layout, capacity')
  expect(query.eq).toHaveBeenCalledWith('venue_id', 'venue-one')
  expect(query.order).toHaveBeenCalledWith('layout')
})

test.each([
  ['AC-049.3.33', { data: null, error: { message: 'Read refused' } }],
  ['AC-049.3.34', { data: null, error: null }],
  ['AC-049.3.35', { data: [], error: null }],
] as const)('%s: unavailable layouts prevent booking', async (_id, result) => {
  query.order.mockResolvedValue(result)
  await expect(loadSpaceLayouts('venue-one')).rejects.toThrow('Venue layouts could not be loaded. Reload before booking.')
})
