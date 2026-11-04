import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { STATUS_REFRESH_MS, useRequestResource } from '../useRequestResource'

afterEach(() => { vi.useRealTimers() })

test('AC-003.2.2: refreshes status periodically and on focus, stopping after unmount', async () => {
  vi.useFakeTimers()
  const read = vi.fn().mockResolvedValue({ ok: true, value: 'submitted' })
  const { result, unmount } = renderHook(() => useRequestResource('owner', read))
  await act(async () => { await Promise.resolve() })
  expect(result.current.value).toBe('submitted')
  read.mockResolvedValue({ ok: true, value: 'approved' })
  await act(async () => { await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS) })
  expect(result.current.value).toBe('approved')
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(read).toHaveBeenCalledTimes(3)
  unmount()
  result.current.refresh()
  await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS)
  expect(read).toHaveBeenCalledTimes(3)
})

test('AC-003.2.3: queues manual refresh while an older status read is pending', async () => {
  let resolve!: (value: { ok: true; value: string }) => void
  const read = vi.fn()
    .mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    .mockResolvedValue({ ok: true, value: 'approved' })
  const { result } = renderHook(() => useRequestResource('owner', read))
  act(() => { result.current.refresh(); result.current.refresh() })
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ ok: true, value: 'under_review' }) })
  expect(read).toHaveBeenCalledTimes(2)
  expect(result.current.value).toBe('approved')
})

test('AC-003.6.3: clears previously visible data if access is revoked', async () => {
  const read = vi.fn().mockResolvedValue({ ok: true, value: 'private request' })
  const { result } = renderHook(() => useRequestResource('owner', read))
  await waitFor(() => expect(result.current.value).toBe('private request'))
  read.mockResolvedValue({ ok: false, reason: 'Request unavailable' })
  await act(async () => { result.current.refresh() })
  expect(result.current.value).toBeNull()
  expect(result.current.error).toBe('Request unavailable')
})

test('AC-003.6.4: ignores an old account response after the account changes', async () => {
  let resolve!: (value: { ok: true; value: string }) => void
  const first = vi.fn(() => new Promise<{ ok: true; value: string }>((done) => { resolve = done }))
  const second = vi.fn().mockResolvedValue({ ok: true, value: 'new account' })
  const { result, rerender } = renderHook(({ owner, read }) => useRequestResource(owner, read), {
    initialProps: { owner: 'first', read: first },
  })
  rerender({ owner: 'second', read: second })
  await waitFor(() => expect(result.current.value).toBe('new account'))
  await act(async () => { resolve({ ok: true, value: 'old private data' }) })
  expect(result.current.value).toBe('new account')
})

test('AC-003.2.4: reports network failures and permits retry', async () => {
  const read = vi.fn().mockRejectedValue(new Error('network'))
  const { result } = renderHook(() => useRequestResource('owner', read))
  await waitFor(() => expect(result.current.error).toContain('Please try again'))
  read.mockResolvedValue({ ok: true, value: 'confirmed' })
  await act(async () => { result.current.refresh() })
  expect(result.current.value).toBe('confirmed')
  expect(result.current.error).toBeNull()
})
