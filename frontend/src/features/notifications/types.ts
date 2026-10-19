/** Where a notification came from. Slice 2's read state is keyed on (source, id). */
export type NotificationSource =
  | 'arrangement_review'
  | 'change_request'
  | 'coordinator_assignment'
  | 'equipment'
  | 'venue_decision'
  | 'venue_request'
  | 'email'
  /** US33: the in-app copy of a notice that used to be email-only. */
  | 'notice'

/** One entry in a user's feed (0072's get_my_notifications). */
export interface AppNotification {
  source: NotificationSource
  id: string
  eventId: string | null
  /** Null where the user's role cannot see the event (Venue Staff); the detail names the venue instead. */
  eventName: string | null
  eventReference: string | null
  title: string
  detail: string | null
  createdAt: string
  /** The venue booking a venue notice is about, so it can be opened; null for other notices. */
  itemId: string | null
  /** When the user read it; null while unread (AC-032.2). */
  readAt: string | null
}
