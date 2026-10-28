import { supabase } from '../../lib/supabase'

export interface BookingSpace { layout: string; attendance: number }
export interface SpaceLayout { layout: string; capacity: number }
export function spaceError(space: BookingSpace): string | null {
  return !space.layout.trim() || !Number.isSafeInteger(space.attendance) || space.attendance < 1
    ? 'Choose a layout and enter a positive whole number of people for this space.' : null
}
export async function loadSpaceLayouts(venueId: string): Promise<SpaceLayout[]> {
  const { data, error } = await supabase.from('venue_layouts').select('layout, capacity').eq('venue_id', venueId).order('layout')
  if (error || !data?.length) throw new Error('Venue layouts could not be loaded. Reload before booking.')
  return data as SpaceLayout[]
}
