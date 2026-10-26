import { z } from 'zod'
import { supabase } from '../../../lib/supabase'
import type { ReadinessLine } from './types'

export const READINESS_MESSAGES = {
  notAssigned: 'Only the event\'s assigned Coordinator can see its readiness.',
  notFound: 'This event could not be found.',
  loadFailed: 'The event\'s readiness could not be loaded. Please try again.',
} as const

export type ReadinessResult = { ok: true; lines: ReadinessLine[] } | { ok: false; reason: string }

const rowSchema = z.object({
  arrangement: z.string(),
  label: z.string(),
  complete: z.boolean(),
  detail: z.string(),
  sort_order: z.number().int(),
})

/**
 * AC-005.1, AC-005.4, AC-005.6: the event's readiness as it is now. The database decides who
 * may see it and reads every arrangement live, so nothing here can go stale.
 */
export async function getEventReadiness(eventId: string): Promise<ReadinessResult> {
  const { data, error } = await supabase.rpc('get_event_readiness', { p_event_id: eventId })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: READINESS_MESSAGES.notAssigned }
    if (error.code === 'P0002') return { ok: false, reason: READINESS_MESSAGES.notFound }
    console.error('[readiness] getEventReadiness', error)
    return { ok: false, reason: READINESS_MESSAGES.loadFailed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[readiness] getEventReadiness: unexpected shape', parsed.error)
    return { ok: false, reason: READINESS_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    lines: parsed.data
      .map((row) => ({ arrangement: row.arrangement, label: row.label, complete: row.complete, detail: row.detail, sortOrder: row.sort_order }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

export const SAFETY_SEND_MESSAGES = {
  notReady: 'Every arrangement on the Readiness card must be complete before the event can go to the Safety Officer.',
  notPlanning: 'Only an event in Planning can be sent for safety review.',
  notAssigned: 'Only the event\'s assigned Coordinator can send it for safety review.',
  failed: 'The event could not be sent for safety review. Please try again.',
} as const

export type SendForSafetyReviewResult = { ok: true } | { ok: false; reason: string }

/** US43 AC-043.1: the Coordinator sends the event to the Safety Officers (0108). */
export async function sendForSafetyReview(eventId: string): Promise<SendForSafetyReviewResult> {
  const { error } = await supabase.rpc('send_for_safety_review', { p_event_id: eventId })
  if (!error) return { ok: true }
  if (error.code === '55000') return { ok: false, reason: SAFETY_SEND_MESSAGES.notReady }
  if (error.code === '22000') return { ok: false, reason: SAFETY_SEND_MESSAGES.notPlanning }
  if (error.code === '42501') return { ok: false, reason: SAFETY_SEND_MESSAGES.notAssigned }
  console.error('[readiness] sendForSafetyReview', error)
  return { ok: false, reason: SAFETY_SEND_MESSAGES.failed }
}

