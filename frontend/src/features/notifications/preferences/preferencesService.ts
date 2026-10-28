import { z } from 'zod'
import { supabase } from '../../../lib/supabase'

/** One notification type the user receives, with their choice for each channel (0077). */
export interface NotificationPreference {
  typeCode: string
  label: string
  description: string
  inApp: boolean
  email: boolean
  /** False while the type is still on its default (both on, AC-033.3). */
  customised: boolean
  /** An administrator has switched this channel off for everyone, which overrides the person's choice. */
  inAppOffForEveryone: boolean
  emailOffForEveryone: boolean
}

export const PREFERENCE_MESSAGES = {
  notSignedIn: 'Sign in to see your notification settings.',
  loadFailed: 'Your notification settings could not be loaded. Please try again.',
  saveFailed: 'That setting could not be saved. Please try again.',
  notApplicable: 'That notification type does not apply to you.',
} as const

export type PreferencesResult = { ok: true; preferences: NotificationPreference[] } | { ok: false; reason: string }
export type SaveResult = { ok: true } | { ok: false; reason: string }

const rowSchema = z.object({
  type_code: z.string(),
  label: z.string(),
  description: z.string(),
  in_app: z.boolean(),
  email: z.boolean(),
  customised: z.boolean(),
  in_app_off_for_everyone: z.boolean(),
  email_off_for_everyone: z.boolean(),
})

/** AC-033.1, AC-033.3: the types for the user's role, each with their choice or the default. */
export async function getMyNotificationPreferences(): Promise<PreferencesResult> {
  const { data, error } = await supabase.rpc('get_my_notification_preferences')
  if (error) {
    if (error.code === '42501') return { ok: false, reason: PREFERENCE_MESSAGES.notSignedIn }
    console.error('[notification preferences] load', error)
    return { ok: false, reason: PREFERENCE_MESSAGES.loadFailed }
  }
  const parsed = z.array(rowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    console.error('[notification preferences] load: unexpected shape', parsed.error)
    return { ok: false, reason: PREFERENCE_MESSAGES.loadFailed }
  }
  return {
    ok: true,
    preferences: parsed.data.map((row) => ({
      typeCode: row.type_code, label: row.label, description: row.description,
      inApp: row.in_app, email: row.email, customised: row.customised,
      inAppOffForEveryone: row.in_app_off_for_everyone, emailOffForEveryone: row.email_off_for_everyone,
    })),
  }
}

/** AC-033.2: saves both channels for one type. */
export async function setMyNotificationPreference(typeCode: string, inApp: boolean, email: boolean): Promise<SaveResult> {
  const { error } = await supabase.rpc('set_my_notification_preference', { p_type: typeCode, p_in_app: inApp, p_email: email })
  if (error) {
    if (error.code === '42501') return { ok: false, reason: PREFERENCE_MESSAGES.notSignedIn }
    if (error.code === '22023') return { ok: false, reason: PREFERENCE_MESSAGES.notApplicable }
    console.error('[notification preferences] save', error)
    return { ok: false, reason: PREFERENCE_MESSAGES.saveFailed }
  }
  return { ok: true }
}
