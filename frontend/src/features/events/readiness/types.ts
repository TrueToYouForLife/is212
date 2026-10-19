/**
 * One line of an event's readiness summary (US5, 0076's get_event_readiness). `arrangement` is
 * an open string on purpose: a later story (the safety review, US43/US44) adds a line in the
 * database, and the summary shows it without any change here.
 */
export interface ReadinessLine {
  arrangement: string
  label: string
  complete: boolean
  detail: string
  sortOrder: number
}
