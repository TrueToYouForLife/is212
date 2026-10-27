import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { getMyNotificationPreferences, setMyNotificationPreference } from './preferencesService'
import type { NotificationPreference } from './preferencesService'

type Channel = 'inApp' | 'email'

/** Says which channels an administrator has switched off for everyone, if any. */
function offForEveryone(preference: NotificationPreference): string | null {
  if (preference.inAppOffForEveryone && preference.emailOffForEveryone) {
    return 'Turned off for everyone by an administrator, in the app and by email.'
  }
  if (preference.emailOffForEveryone) return 'Email for this type is turned off for everyone by an administrator.'
  if (preference.inAppOffForEveryone) return 'In-app notices of this type are turned off for everyone by an administrator.'
  return null
}

/**
 * US33 slice 1: for each notification type the user receives (AC-033.1), switch in-app and
 * email on or off independently (AC-033.2); anything never changed is on for both (AC-033.3).
 * Each switch saves straight away and goes back if the save fails. Where an administrator has
 * switched a channel off for everyone, the page says so, so nobody wonders why a switch has no effect.
 */
export function NotificationPreferencesPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading || !profile) return
    let cancelled = false
    void getMyNotificationPreferences().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setPreferences(result.preferences)
        setLoaded(true)
      } else {
        setError(result.reason)
      }
    })
    return () => { cancelled = true }
  }, [userLoading, profile])

  async function toggle(preference: NotificationPreference, channel: Channel) {
    const next = { ...preference, [channel]: !preference[channel], customised: true }
    setSaveError(null)
    setSavedLabel(null)
    setSaving(preference.typeCode)
    setPreferences((current) => current.map((item) => (item.typeCode === preference.typeCode ? next : item)))
    const result = await setMyNotificationPreference(preference.typeCode, next.inApp, next.email)
    setSaving(null)
    if (result.ok) {
      setSavedLabel(preference.label)
    } else {
      setPreferences((current) => current.map((item) => (item.typeCode === preference.typeCode ? preference : item)))
      setSaveError(result.reason)
    }
  }

  if (userLoading) {
    return (
      <PageContainer>
        <p className="text-sm text-slate-500">Checking your session…</p>
      </PageContainer>
    )
  }

  if (!profile) {
    return (
      <PageContainer>
        <Card title="Notification settings">
          <p className="text-sm text-slate-600">Sign in to see your notification settings.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <Link to="/notifications" className="text-sm font-semibold text-indigo-700 hover:underline">← Notifications</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Notification settings</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Choose how each kind of notification reaches you: in the app, by email, or both.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">{savedLabel ? `${savedLabel} saved.` : ''}</p>
      {saveError && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{saveError}</div>
      )}

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      ) : !loaded ? (
        <p className="text-sm text-slate-500">Loading your notification settings…</p>
      ) : preferences.length === 0 ? (
        <Card title="Nothing to set">
          <p className="text-sm text-slate-600">No notifications are sent to your role yet.</p>
        </Card>
      ) : (
        <ul aria-label="Notification types" className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {preferences.map((preference) => (
            <li key={preference.typeCode} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{preference.label}</p>
                <p className="mt-1 text-sm text-slate-600">{preference.description}</p>
                {offForEveryone(preference) && (
                  <p className="mt-1 text-xs font-medium text-amber-800">{offForEveryone(preference)}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-5">
                {(['inApp', 'email'] as const).map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={preference[channel]}
                      disabled={saving === preference.typeCode}
                      aria-label={`${channel === 'inApp' ? 'In-app' : 'Email'}: ${preference.label}`}
                      onChange={() => void toggle(preference, channel)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {channel === 'inApp' ? 'In-app' : 'Email'}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
