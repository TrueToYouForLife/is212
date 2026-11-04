import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useVenueReplacements } from '../useVenueReplacements'
import { replacementFixture } from './venueReplacementFixtures'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../venueReplacementService', () => ({ getVenueReplacements: mocks.load }))
beforeEach(() => { vi.resetAllMocks() })

test('AC-048.1.7: session changes and disabled access discard earlier successful or failed replacement loads', async () => {
  let resolveOld!: (value: unknown) => void
  let rejectOld!: (reason: Error) => void
  mocks.load.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    .mockResolvedValueOnce({ ok: true, value: { ...replacementFixture, sources: [] } })
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
    .mockResolvedValue({ ok: true, value: replacementFixture })
  const { result, rerender } = renderHook(({ enabled, session }) => useVenueReplacements(enabled, session),
    { initialProps: { enabled: true, session: 'old-coordinator' } })
  rerender({ enabled: true, session: 'new-coordinator' })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.data?.sources).toEqual([])
  await act(async () => resolveOld({ ok: true, value: replacementFixture }))
  expect(result.current.data?.sources).toEqual([])
  act(() => { void result.current.reload() })
  expect(result.current.loading).toBe(true)
  rerender({ enabled: false, session: 'signed-out' })
  await act(async () => rejectOld(new Error('late old-session failure')))
  expect(result.current).toMatchObject({ data: null, error: null, loading: false })
  expect(mocks.load).toHaveBeenCalledTimes(3)
  rerender({ enabled: true, session: 'new-coordinator' })
  await waitFor(() => expect(result.current.data).toEqual(replacementFixture))
  expect(result.current.error).toBeNull()
})
