import { useCallback, useEffect, useRef, useState } from 'react'
import { getVenueReplacements } from './venueReplacementService'
import type { VenueReplacementContext } from './venueReplacementService'

/** Share one checked context between booking indicators and retained decisions. */
export function useVenueReplacements(enabled = true, sessionId?: string) {
  const [data, setData] = useState<VenueReplacementContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true); setError(null); setData(null)
    try {
      const result = await getVenueReplacements()
      if (current !== sequence.current) return
      if (result.ok) setData(result.value)
      else setError(result.reason)
    } catch {
      if (current !== sequence.current) return
      setError('Venue replacements could not be loaded. Please reload.')
    }
    if (current === sequence.current) setLoading(false)
  }, [])
  const invalidate = useCallback(() => { sequence.current++ }, [])
  useEffect(() => {
    if (enabled) void reload()
    else { setData(null); setError(null); setLoading(false) }
    return invalidate
  }, [enabled, sessionId, reload, invalidate])
  return { data, error, loading, reload }
}
export type VenueReplacementsState = ReturnType<typeof useVenueReplacements>
