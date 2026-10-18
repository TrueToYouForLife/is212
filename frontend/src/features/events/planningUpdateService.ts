import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { validateEventRequest } from './validation'
import type { RequirementCodeOptions } from './validation'
import type { EventRequestInput } from './types'

const valuesSchema = z.object({
  name: z.string().nullable(), purpose: z.string().nullable(),
  eventType: z.string().nullable(), description: z.string().nullable(),
  proposedStart: z.string().nullable(), proposedEnd: z.string().nullable(),
  expectedAttendance: z.number().nullable(), programme: z.string().nullable(),
  layoutPreference: z.string().nullable(), accessibilityRequirements: z.array(z.string()),
  facilityRequirements: z.array(z.string()), equipmentRequirements: z.array(z.string()),
  specialArrangements: z.string().nullable(),
})
const historySchema = z.object({
  id: z.string().uuid(), changed_by_name: z.string(), changed_at: z.string(),
  changes: z.record(z.object({ before: z.unknown(), after: z.unknown() })),
})
const planningSchema = z.object({
  version: z.string().min(1), status: z.string(), values: valuesSchema,
  history: z.array(historySchema),
})
export type PlanningDetails = z.infer<typeof planningSchema>
export const PLANNING_MESSAGES = {
  load: 'Planning details and history could not be loaded. Please reload.',
  forbidden: 'Only the assigned coordinator can edit these planning details. Refresh to check your access.',
  stale: 'This event has changed. Reload planning details and review the latest values before saving.',
  status: 'Planning details can only be edited while the event is Approved or Planning.',
  invalid: 'Check the event details and requirement choices before saving.',
  failed: 'The save could not be confirmed. Reload planning details to check before trying again.',
} as const

export async function getEventPlanning(eventId: string): Promise<
  { ok: true; value: PlanningDetails } | { ok: false; reason: string }
> {
  if (!z.string().uuid().safeParse(eventId).success) return { ok: false, reason: PLANNING_MESSAGES.load }
  try {
    const { data, error } = await supabase.rpc('get_event_planning', { p_event_id: eventId })
    const parsed = planningSchema.safeParse(data)
    return !error && parsed.success ? { ok: true, value: parsed.data }
      : { ok: false, reason: PLANNING_MESSAGES.load }
  } catch {
    return { ok: false, reason: PLANNING_MESSAGES.load }
  }
}

export async function updateEventPlanning(eventId: string, version: string, input: EventRequestInput, codes: RequirementCodeOptions): Promise<
  { ok: true; changed: boolean } | { ok: false; reason: string }
> {
  const result = validateEventRequest(input, { codes })
  if (!z.string().uuid().safeParse(eventId).success || !version || !result.ok) {
    return { ok: false, reason: PLANNING_MESSAGES.invalid }
  }
  // Explicit projection: registration has its own US52 workflow.
  const v = result.value
  const values = {
    name: v.name, purpose: v.purpose, eventType: v.eventType, description: v.description,
    proposedStart: v.proposedStart.toISOString(), proposedEnd: v.proposedEnd.toISOString(),
    expectedAttendance: v.expectedAttendance, programme: v.programme,
    layoutPreference: v.layoutPreference, accessibilityRequirements: v.accessibilityRequirements,
    facilityRequirements: v.facilityRequirements, equipmentRequirements: v.equipmentRequirements,
    specialArrangements: v.specialArrangements,
  }
  try {
    const { data, error } = await supabase.rpc('update_event_planning', {
      p_event_id: eventId, p_version: version, p_values: values,
    })
    if (error) return { ok: false, reason:
      error.code === '42501' ? PLANNING_MESSAGES.forbidden
        : error.code === '40001' ? PLANNING_MESSAGES.stale
          : error.code === '22000' ? PLANNING_MESSAGES.status
            : ['22023', '23514', '23503', '22P02', '22007', '22008', '22003'].includes(error.code) ? PLANNING_MESSAGES.invalid
              : PLANNING_MESSAGES.failed }
    if (data !== null && !z.string().uuid().safeParse(data).success) return { ok: false, reason: PLANNING_MESSAGES.failed }
    return { ok: true, changed: data !== null }
  } catch {
    return { ok: false, reason: PLANNING_MESSAGES.failed }
  }
}
