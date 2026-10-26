import type { ReadinessLine } from './types'

/** Lines that do not hold the safety review back: registration only opens once the event is
 * confirmed, and the safety review is the step being taken. */
const NOT_REQUIRED_BEFORE_SAFETY_REVIEW = new Set(['registration_setup', 'safety_review'])

/**
 * PURE — US43 AC-043.1: the same rule as 0108's event_ready_for_safety_review(), so the
 * Readiness card only offers "Send for safety review" when the database will accept it.
 */
export function readyForSafetyReview(lines: ReadinessLine[]): boolean {
  const required = lines.filter((line) => !NOT_REQUIRED_BEFORE_SAFETY_REVIEW.has(line.arrangement))
  return required.length > 0 && required.every((line) => line.complete)
}
