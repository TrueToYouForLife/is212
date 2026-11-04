import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { SessionContext, useCurrentUser } from '../sessionContext'

test('returns the provider session including its refresh operation', () => {
  const value = { session: null, profile: null, loading: true, refresh: vi.fn() }
  const { result } = renderHook(useCurrentUser, { wrapper: ({ children }: { children: ReactNode }) => <SessionContext.Provider value={value}>{children}</SessionContext.Provider> })
  expect(result.current).toBe(value)
})

test('reports a missing provider instead of inventing a signed-out session', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() => renderHook(useCurrentUser)).toThrow('useCurrentUser must be used inside a SessionProvider')
  } finally {
    error.mockRestore()
  }
})
