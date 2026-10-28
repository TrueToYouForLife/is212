import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EventReadinessCard } from '../EventReadinessCard'
import { SAFETY_SEND_MESSAGES } from '../readinessService'
import { readyForSafetyReview } from '../safetyReviewReadiness'
import type { ReadinessLine } from '../types'

const mocks = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn() }))
// US43 tests run with the safety review switched on.
vi.mock('../../../../lib/features', async (importOriginal) => ({
  FEATURES: { ...(await importOriginal<typeof import('../../../../lib/features')>()).FEATURES, safetyReview: true },
}))
vi.mock('../readinessService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../readinessService')>()),
  getEventReadiness: mocks.load,
  sendForSafetyReview: mocks.send,
}))

const line = (arrangement: string, complete: boolean, sortOrder: number): ReadinessLine =>
  ({ arrangement, label: arrangement, complete, detail: `${arrangement} detail`, sortOrder })

const READY = [line('venue_booking', true, 1), line('programme', true, 4), line('registration_setup', false, 5), line('safety_review', false, 6)]
const NOT_READY = [line('venue_booking', true, 1), line('programme', false, 4), line('safety_review', false, 6)]

async function renderCard(status: 'planning' | 'approved' | 'awaiting_safety_review', lines: ReadinessLine[], onSent = vi.fn()) {
  mocks.load.mockResolvedValue({ ok: true, lines })
  render(<MemoryRouter><EventReadinessCard eventId="e-1" status={status} onSent={onSent} /></MemoryRouter>)
  await act(async () => { await Promise.resolve() })
  return onSent
}

beforeEach(() => {
  mocks.load.mockReset()
  mocks.send.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('AC-043.1 — the Coordinator sends an event for review once its arrangements are complete', () => {
  test('AC-043.1.11: ready means every readiness line is complete, except registration setup and the safety review itself', () => {
    expect(readyForSafetyReview(READY)).toBe(true)
    expect(readyForSafetyReview(NOT_READY)).toBe(false)
    expect(readyForSafetyReview([line('safety_review', false, 6)])).toBe(false)
    expect(readyForSafetyReview([])).toBe(false)
  })

  test('AC-043.1.12: in Planning with everything complete, "Send for safety review" sends it and the page refreshes', async () => {
    mocks.send.mockResolvedValue({ ok: true })
    const onSent = await renderCard('planning', READY)
    fireEvent.click(screen.getByRole('button', { name: 'Send for safety review' }))
    await act(async () => { await Promise.resolve() })
    expect(mocks.send).toHaveBeenCalledWith('e-1')
    expect(onSent).toHaveBeenCalledTimes(1)
  })

  test('AC-043.1.13: until everything is complete the card says so instead, and outside Planning it offers nothing', async () => {
    await renderCard('planning', NOT_READY)
    expect(screen.queryByRole('button', { name: 'Send for safety review' })).toBeNull()
    expect(screen.getByText(/becomes available once every arrangement above is complete/)).toBeInTheDocument()
    document.body.innerHTML = ''
    await renderCard('awaiting_safety_review', READY)
    expect(screen.queryByRole('button', { name: 'Send for safety review' })).toBeNull()
    expect(screen.queryByText(/becomes available/)).toBeNull()
  })

  test('AC-043.1.14: a refused send says why, the page is not refreshed, and the button can be pressed again', async () => {
    let finish: (value: unknown) => void = () => undefined
    mocks.send.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const onSent = await renderCard('planning', READY)
    fireEvent.click(screen.getByRole('button', { name: 'Send for safety review' }))
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
    await act(async () => { finish({ ok: false, reason: SAFETY_SEND_MESSAGES.notReady }) })
    expect(screen.getByRole('alert')).toHaveTextContent('must be complete')
    expect(onSent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send for safety review' })).not.toBeDisabled()
  })
})
