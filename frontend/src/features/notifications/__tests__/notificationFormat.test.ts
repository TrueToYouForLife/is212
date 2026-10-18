import { describe, expect, test } from 'vitest'
import { formatNotificationTime, notificationEventLabel } from '../notificationFormat'

// 15:30 on 10 Oct 2026 in Singapore.
const NOW = new Date('2026-10-10T07:30:00Z')

describe('AC-032.1 — each notification says what happened, which event and when', () => {
  test('AC-032.1.8: today and yesterday are named; older notices show their date, all in Singapore time', () => {
    expect(formatNotificationTime('2026-10-10T07:04:00Z', NOW)).toBe('Today, 3:04 pm')
    expect(formatNotificationTime('2026-10-09T01:00:00Z', NOW)).toBe('Yesterday, 9:00 am')
    expect(formatNotificationTime('2026-01-01T04:15:00Z', NOW)).toBe('1 Jan 2026, 12:15 pm')
  })

  test('AC-032.1.9: the day changes at midnight in Singapore, not in UTC', () => {
    // 16:30 UTC on 9 Oct is 00:30 on 10 Oct in Singapore: today, not yesterday.
    expect(formatNotificationTime('2026-10-09T16:30:00Z', NOW)).toBe('Today, 12:30 am')
    // 15:59 UTC on 9 Oct is still 9 Oct in Singapore.
    expect(formatNotificationTime('2026-10-09T15:59:00Z', NOW)).toBe('Yesterday, 11:59 pm')
  })

  test('AC-032.1.10: the event is named by its reference and name, or whichever of them the user can see', () => {
    expect(notificationEventLabel({ eventReference: 'EVT-1', eventName: 'Gala' })).toBe('EVT-1 · Gala')
    expect(notificationEventLabel({ eventReference: 'EVT-1', eventName: null })).toBe('EVT-1')
    expect(notificationEventLabel({ eventReference: null, eventName: 'Gala' })).toBe('Gala')
    expect(notificationEventLabel({ eventReference: null, eventName: null })).toBeNull()
  })
})
