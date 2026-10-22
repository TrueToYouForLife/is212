import { z } from 'zod'
import { supabase } from '../../lib/supabase'

export const bufferDuration = z.number().int().nonnegative().max(2147483647).multipleOf(15)
const settingsSchema = z.object({ setupMinutes: bufferDuration, turnaroundMinutes: bufferDuration, version: z.string().min(1) })
const savedSchema = settingsSchema.extend({ reviewCount: z.number().int().nonnegative() })
export type BufferSettings = z.infer<typeof settingsSchema>
type Result<T> = { ok: true; value: T } | { ok: false; reason: string; stale?: boolean }
const failed = 'Venue timing settings could not be loaded or saved. Please try again.'
function refusal(error: { code?: string }): Result<never> {
 if (error.code === '40001') return { ok: false, stale: true, reason: 'This venue changed. Reload the settings before saving again.' }
 if (error.code === '42501') return { ok: false, reason: 'Only Venue Staff can configure setup and turnaround.' }
 if (error.code === '22023') return { ok: false, reason: 'Use non-negative multiples of 15 minutes for an active venue.' }
 return { ok: false, reason: failed }
}
export async function getBufferSettings(venueId: string): Promise<Result<BufferSettings>> {
 try {
  const { data, error } = await supabase.rpc('get_venue_buffer_settings', { p_venue_id: venueId })
  if (error) return refusal(error)
  const parsed = settingsSchema.safeParse(data)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: failed }
 } catch { return { ok: false, reason: failed } }
}
export async function saveBufferSettings(venueId: string, settings: BufferSettings): Promise<Result<z.infer<typeof savedSchema>>> {
 if (!settingsSchema.safeParse(settings).success) return { ok: false, reason: 'Enter non-negative whole minutes in multiples of 15.' }
 try {
  const { data, error } = await supabase.rpc('update_venue_buffer_settings', {
   p_venue_id: venueId, p_version: settings.version,
   p_setup_minutes: settings.setupMinutes, p_turnaround_minutes: settings.turnaroundMinutes,
  })
  if (error) return refusal(error)
  const parsed = savedSchema.safeParse(data)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: failed }
 } catch { return { ok: false, reason: 'Save could not be confirmed. Reload the settings before retrying.' } }
}
