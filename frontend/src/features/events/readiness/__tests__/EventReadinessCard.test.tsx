import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EventReadinessCard } from '../EventReadinessCard'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../readinessService', () => ({ getEventReadiness: mocks.load }))

const READY = { ok: true, lines: [{ arrangement: 'programme', label: 'Programme', complete: true, detail: 'Programme added.', sortOrder: 4 }] }
const NOT_READY = { ok: true, lines: [{ arrangement: 'programme', label: 'Programme', complete: false, detail: 'No programme yet.', sortOrder: 4 }] }

function renderCard(refreshVersion = 0) {
  return render(<MemoryRouter><EventReadinessCard eventId="e-1" refreshVersion={refreshVersion} /></MemoryRouter>)
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.load.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('AC-005.1 — the Coordinator sees the readiness summary', () => {
  test('AC-005.1.5: the summary loads for the event, and a failure is shown instead of a summary', async () => {
    mocks.load.mockResolvedValueOnce(NOT_READY)
    const { unmount } = renderCard()
    expect(screen.getByText('Checking arrangements…')).toBeInTheDocument()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('No programme yet.')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledWith('e-1')
    unmount()

    mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Only the event\'s assigned Coordinator can see its readiness.' })
    renderCard()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('alert')).toHaveTextContent('assigned Coordinator')
  })
})

describe('AC-005.7 — the summary keeps up with changes', () => {
  test('AC-005.7.2: it is read again every 30 seconds, so changes made by others appear without reloading', async () => {
    mocks.load.mockResolvedValueOnce(NOT_READY).mockResolvedValueOnce(READY)
    renderCard()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('No programme yet.')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(30_000); await Promise.resolve() })
    expect(screen.getByText('Programme added.')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledTimes(2)
  })

  test('AC-005.7.3: it is read again at once when the page refreshes after a change made here', async () => {
    mocks.load.mockResolvedValueOnce(NOT_READY).mockResolvedValueOnce(READY)
    const { rerender } = renderCard(0)
    await act(async () => { await Promise.resolve() })
    rerender(<MemoryRouter><EventReadinessCard eventId="e-1" refreshVersion={1} /></MemoryRouter>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Programme added.')).toBeInTheDocument()
  })

  test('AC-005.7.4: once the page is left, it stops reading and ignores an answer still on its way', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { unmount } = renderCard()
    unmount()
    finish(READY)
    await act(async () => { await Promise.resolve() })
    vi.advanceTimersByTime(60_000)
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })
})
