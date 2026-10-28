import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SafetyReviewDecisionsPanel } from '../SafetyReviewDecisionsPanel'
import type { SafetyReviewDecision } from '../safetyDecisionService'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../safetyDecisionService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../safetyDecisionService')>()),
  getSafetyReviewDecisions: mocks.load,
}))

const LATEST: SafetyReviewDecision = {
  decisionId: 'd-2', decision: 'request_changes', comment: 'Move the stage', revisit: ['venue', 'equipment'],
  decidedAt: '2043-01-12T01:00:00Z', decidedByName: 'Sam Safety',
  assessments: [{ factor: 'emergency_access', concern: true, note: 'Stage blocks the exit' }, { factor: 'attendance', concern: false, note: null }],
}
const EARLIER: SafetyReviewDecision = {
  decisionId: 'd-1', decision: 'reject', comment: 'Too small', revisit: ['venue'],
  decidedAt: '2043-01-10T01:00:00Z', decidedByName: null, assessments: [],
}

async function renderPanel() {
  const view = render(<SafetyReviewDecisionsPanel eventId="e-1" />)
  await act(async () => { await Promise.resolve() })
  return view
}

beforeEach(() => mocks.load.mockReset())

describe('AC-044.5 — the Coordinator sees the decision and comments', () => {
  test('AC-044.5.4: the latest decision shows who decided and when, what to revisit, the comment and each concern; earlier ones follow', async () => {
    mocks.load.mockResolvedValue({ ok: true, decisions: [LATEST, EARLIER] })
    await renderPanel()
    expect(screen.getByText(/Changes requested by Sam Safety on/)).toBeInTheDocument()
    expect(screen.getByText('Revisit: venue and equipment')).toBeInTheDocument()
    expect(screen.getByText('Comment: Move the stage')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Concerns' })).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Emergency access: Stage blocks the exit'])
    expect(screen.getByText('Earlier decisions (1)')).toBeInTheDocument()
    expect(screen.getByText(/Rejected by the Safety Officer on/)).toBeInTheDocument()
  })

  test('AC-044.5.5: before any decision the panel shows nothing; a failed load says why; a late answer after leaving is ignored', async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, decisions: [] })
    const first = await renderPanel()
    expect(first.container).toBeEmptyDOMElement()
    first.unmount()
    mocks.load.mockResolvedValueOnce({ ok: false, reason: 'Could not load.' })
    const second = await renderPanel()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.')
    second.unmount()
    let finish: (value: unknown) => void = () => undefined
    mocks.load.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const third = render(<SafetyReviewDecisionsPanel eventId="e-1" />)
    third.unmount()
    finish({ ok: true, decisions: [LATEST] })
    await Promise.resolve()
    expect(screen.queryByText(/Changes requested/)).toBeNull()
  })
})
