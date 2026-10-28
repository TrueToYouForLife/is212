import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { formatNotificationTime, notificationEventLabel, notificationTarget } from '../notificationFormat'
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../notificationService'
import type { AppNotification } from '../types'

const markAllClassName =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition ' +
  'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

const sameNotice = (a: Pick<AppNotification, 'source' | 'id'>, b: Pick<AppNotification, 'source' | 'id'>) =>
  a.source === b.source && a.id === b.id

/**
 * US32: every notification addressed to the signed-in user, newest first (AC-032.1), and only
 * theirs (AC-032.5, decided by the database). Unread ones stand out (AC-032.2); opening one marks
 * it read and goes to its event or item (AC-032.3); all can be marked read at once (AC-032.4).
 */
export function NotificationsPage() {
  const { profile, loading: userLoading } = useCurrentUser()
  const navigate = useNavigate()
  const role = profile?.role ?? null
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (userLoading || !profile) return
    let cancelled = false
    void getMyNotifications().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setNotifications(result.notifications)
        setLoaded(true)
      } else {
        setError(result.reason)
      }
    })
    return () => { cancelled = true }
  }, [userLoading, profile])

  function showAsRead(read: (notification: AppNotification) => boolean) {
    const now = new Date().toISOString()
    setNotifications((current) =>
      current.map((notification) => (read(notification) && !notification.readAt ? { ...notification, readAt: now } : notification)))
  }

  async function open(notification: AppNotification) {
    setActionError(null)
    if (!notification.readAt) {
      const result = await markNotificationRead(notification)
      if (result.ok) showAsRead((other) => sameNotice(other, notification))
      // Not being able to mark it read must not stop the user getting where they were going.
      else setActionError(result.reason)
    }
    const target = notificationTarget(notification, role)
    if (target) navigate(target)
  }

  async function markAll() {
    setActionError(null)
    setMarkingAll(true)
    const result = await markAllNotificationsRead()
    setMarkingAll(false)
    if (result.ok) showAsRead(() => true)
    else setActionError(result.reason)
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
        <Card title="Notifications">
          <p className="text-sm text-slate-600">Sign in to see your notifications.</p>
        </Card>
      </PageContainer>
    )
  }

  const unread = notifications.filter((notification) => !notification.readAt).length

  return (
    <PageContainer>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Everything sent to you about your events, newest first, including notices that were emailed to you.
          </p>
          <Link to="/notifications/settings" className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:underline">
            Notification settings
          </Link>
        </div>
        {notifications.length > 0 && (
          <button type="button" className={markAllClassName} disabled={unread === 0 || markingAll} onClick={() => void markAll()}>
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{actionError}</div>
      )}

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>
      ) : !loaded ? (
        <p className="text-sm text-slate-500">Loading your notifications…</p>
      ) : notifications.length === 0 ? (
        <Card title="Nothing yet">
          <p className="text-sm text-slate-600">You have no notifications yet. Updates about your events will appear here.</p>
        </Card>
      ) : (
        <ul aria-label="Your notifications" className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {notifications.map((notification) => {
            const event = notificationEventLabel(notification)
            const isUnread = !notification.readAt
            return (
              <li key={`${notification.source}:${notification.id}`} data-unread={isUnread || undefined}>
                <button
                  type="button"
                  onClick={() => void open(notification)}
                  className={`block w-full px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ${
                    isUnread ? 'bg-indigo-50/60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className={`flex items-center gap-2 text-sm text-slate-900 ${isUnread ? 'font-semibold' : 'font-normal'}`}>
                      {isUnread && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}
                      {isUnread && <span className="sr-only">Unread: </span>}
                      {notification.title}
                    </p>
                    <time dateTime={notification.createdAt} className="text-xs text-slate-500">
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                  </div>
                  {event && <p className="mt-1 text-xs font-medium text-indigo-700">{event}</p>}
                  {notification.detail && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{notification.detail}</p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </PageContainer>
  )
}
