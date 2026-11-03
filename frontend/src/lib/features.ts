/** Temporary switches for screens still being built on main. Delete each one when its
 *  story is Done; a flag that outlives its story is dead code. */
export const FEATURES = {
  /** US43: on only once 0108's safety_review_settings is switched on too. */
  safetyReview: import.meta.env.VITE_FEATURE_SAFETY_REVIEW === 'true',
} as const