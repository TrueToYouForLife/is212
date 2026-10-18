/**
 * PURE MODULE — US32. How a notification reads in the list: its event, and when it happened.
 * Times are shown in Singapore time, like the rest of the app.
 */
import type { AppNotification } from './types'

const SGT = 'Asia/Singapore'
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: SGT, year: 'numeric', month: '2-digit', day: '2-digit' })
const TIME = new Intl.DateTimeFormat('en-SG', { timeZone: SGT, hour: 'numeric', minute: '2-digit', hour12: true })
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: SGT, day: 'numeric', month: 'short', year: 'numeric' })

const DAY_MS = 86_400_000

/** AC-032.1 "when": "Today, 3:04 pm", "Yesterday, 9:00 am", or "1 Jan 2039, 3:04 pm". */
export function formatNotificationTime(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt)
  // Some ICU versions put a narrow no-break space before am/pm; keep an ordinary one.
  const time = TIME.format(date).replace(/\s/g, ' ')
  const day = DAY.format(date)
  if (day === DAY.format(now)) return `Today, ${time}`
  if (day === DAY.format(new Date(now.getTime() - DAY_MS))) return `Yesterday, ${time}`
  return `${DATE.format(date)}, ${time}`
}

/** AC-032.1 "which event": its reference and name, whichever the user is allowed to see. */
export function notificationEventLabel(notification: Pick<AppNotification, 'eventName' | 'eventReference'>): string | null {
  const parts = [notification.eventReference, notification.eventName].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : null
}
