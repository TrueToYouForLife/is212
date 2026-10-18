import { useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatNotificationTime, notificationEventLabel } from '../notificationFormat'
import { getMyNotifications } from '../notificationService'
import type { AppNotification } from '../types'

/**
 * US32 slice 1: every notification addressed to the signed-in user, newest first (AC-032.1),
 * and only theirs (AC-032.5, decided by the database). Behind VITE_FEATURE_NOTIFICATIONS until
 * read state (slice 2) is built.
 */
export function NotificationsPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading || !profile) return
    let cancelled = false
    void getMyNotifications().then((result) => {
      if (cancelled) return
      if (result.ok) setNotifications(result.notifications)
      else setError(result.reason)
    })
    return () => { cancelled = true }
  }, [userLoading, profile])

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
        <Card title="Notifications">
          <p className="text-sm text-slate-600">Sign in to see your notifications.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Notifications</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Everything sent to you about your events, newest first, including notices that were emailed to you.
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      ) : !notifications ? (
        <p className="text-sm text-slate-500">Loading your notifications…</p>
      ) : notifications.length === 0 ? (
        <Card title="Nothing yet">
          <p className="text-sm text-slate-600">You have no notifications yet. Updates about your events will appear here.</p>
        </Card>
      ) : (
        <ul aria-label="Your notifications" className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {notifications.map((notification) => {
            const event = notificationEventLabel(notification)
            return (
              <li key={`${notification.source}:${notification.id}`} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                  <time dateTime={notification.createdAt} className="text-xs text-slate-500">
                    {formatNotificationTime(notification.createdAt)}
                  </time>
                </div>
                {event && <p className="mt-1 text-xs font-medium text-indigo-700">{event}</p>}
                {notification.detail && (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{notification.detail}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </PageContainer>
  )
}
