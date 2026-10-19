import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { NOTIFICATIONS_CHANGED, getUnreadNotificationCount } from './notificationService'

/**
 * AC-032.2: the unread count for the nav. Re-read on every page change and whenever
 * notifications are marked read, so the count never lags the list. Null until known, or if it
 * could not be read: the nav then shows no number rather than a wrong one.
 */
export function useUnreadNotificationCount(enabled: boolean): number | null {
  const { pathname } = useLocation()
  const [count, setCount] = useState<number | null>(null)
  const [changes, setChanges] = useState(0)

  useEffect(() => {
    const onChange = () => setChanges((value) => value + 1)
    window.addEventListener(NOTIFICATIONS_CHANGED, onChange)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, onChange)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      return
    }
    let cancelled = false
    void getUnreadNotificationCount().then((result) => {
      if (!cancelled) setCount(result.ok ? result.count : null)
    })
    return () => { cancelled = true }
  }, [enabled, pathname, changes])

  return count
}
