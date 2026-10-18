/** Temporary switches for screens still being built on main. Delete each one when its
 *  story is Done; a flag that outlives its story is dead code. */
export const FEATURES = {
  venueBlocks: import.meta.env.VITE_FEATURE_VENUE_BLOCKS === 'true',
  venueSuitability: import.meta.env.VITE_FEATURE_VENUE_SUITABILITY === 'true',
  venueBooking: import.meta.env.VITE_FEATURE_VENUE_BOOKING === 'true',
} as const