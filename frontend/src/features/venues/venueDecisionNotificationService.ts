import { supabase } from '../../lib/supabase'

export interface VenueDecisionNotification {
  id: string
  booking_id: string
  event_id: string
  venue_name: string
  event_reference: string | null
  decision: 'confirmed' | 'rejected'
  reason: string | null
  alternative: string | null
  reviewed_at: string
}
type Result = { ok: true; notifications: VenueDecisionNotification[] } | { ok: false; reason: string }

export async function listVenueDecisionNotifications(): Promise<Result> {
  const unavailable = { ok: false as const, reason: 'Booking notifications could not be loaded. Try refreshing.' }
  try {
    // RLS checks recipient and current assignment; no browser-selected recipient.
    const { data, error } = await supabase.from('venue_booking_decision_notifications')
      .select('id,booking_id,event_id,venue_name,event_reference,decision,reason,alternative,reviewed_at')
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)
    if (error) return unavailable
    return { ok: true, notifications: (data ?? []) as VenueDecisionNotification[] }
  } catch { return unavailable }
}
