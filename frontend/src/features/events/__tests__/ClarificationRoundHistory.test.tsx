import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ClarificationRoundHistory } from '../components/ClarificationRoundHistory'
import { CLARIFICATION_SERVICE_MESSAGES as messages } from '../clarificationResponseService'
import { clarificationChanges, formatClarificationValue } from '../clarificationDisplay'

/**
 * US37 — the screen half of AC-037.5 (SCRUM-234).
 *
 * Who may read a round is settled by 0096's policy and tested in clarification_response.sql
 * (AC-037.5.6 to .5.8). These check that a round reads as what was asked, what was answered
 * and what changed — and that a failed read is not shown as "you have never replied".
 */

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../clarificationResponseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../clarificationResponseService')>()),
  loadClarificationRounds: (id: string) => mocks.load(id),
}))

const EVENT = 'c0ffee00-0000-4000-8000-000000000001'

const round1 = {
  id: 'r1', round: 1, reviewNote: 'Please confirm the expected attendance.',
  reply: 'It is 140 after the faculty invite.',
  beforeValues: { expected_attendance: 80, layout_preference: 'theatre' },
  afterValues: { expected_attendance: 140, layout_preference: 'banquet' },
  respondedAt: '2046-10-02T02:00:00Z',
}

beforeEach(() => { mocks.load.mockReset() })

describe('AC-037.5 — the rounds already answered', () => {
  test('AC-037.5.16: a round shows the question, the reply and each revision', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [round1] })
    render(<ClarificationRoundHistory eventId={EVENT} />)

    expect(await screen.findByText('Reply 1')).toBeInTheDocument()
    expect(screen.getByText('Please confirm the expected attendance.')).toBeInTheDocument()
    expect(screen.getByText('It is 140 after the faculty invite.')).toBeInTheDocument()
    expect(screen.getByText('Expected attendance')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('140')).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledWith(EVENT)
  })

  test('AC-037.5.17: the question shown is the one that round answered', async () => {
    // 0096 copies the note into the record because the event's own review_note is cleared
    // on resubmission — by round 2, round 1's question is nowhere else to be found.
    mocks.load.mockResolvedValue({
      ok: true,
      value: [
        { ...round1, id: 'r2', round: 2, reviewNote: 'And the hearing loop?',
          reply: 'Two people need it.',
          beforeValues: { accessibility_requirements: [] },
          afterValues: { accessibility_requirements: ['hearing_loop'] } },
        round1,
      ],
    })
    render(<ClarificationRoundHistory eventId={EVENT} />)

    expect(await screen.findByText('And the hearing loop?')).toBeInTheDocument()
    expect(screen.getByText('Please confirm the expected attendance.')).toBeInTheDocument()
  })

  test('AC-037.5.18: a round that revised nothing says so', async () => {
    mocks.load.mockResolvedValue({
      ok: true,
      value: [{ ...round1, beforeValues: {}, afterValues: {} }],
    })
    render(<ClarificationRoundHistory eventId={EVENT} />)

    expect(await screen.findByText('Nothing was changed.')).toBeInTheDocument()
  })

  test('AC-037.5.19: no rounds yet says so, rather than looking broken', async () => {
    mocks.load.mockResolvedValue({ ok: true, value: [] })
    render(<ClarificationRoundHistory eventId={EVENT} />)

    expect(await screen.findByText('No clarification has been answered yet.')).toBeInTheDocument()
  })

  test('AC-037.5.20: a failed read is reported, never shown as an empty history', async () => {
    mocks.load.mockResolvedValue({ ok: false, reason: messages.historyFailed })
    render(<ClarificationRoundHistory eventId={EVENT} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.historyFailed)
    expect(screen.queryByText('No clarification has been answered yet.')).not.toBeInTheDocument()
  })
})

describe('AC-037.5 — how a stored value reads', () => {
  test('AC-037.5.21: lists, flags and empty values each read sensibly', () => {
    expect(formatClarificationValue('accessibility_requirements', ['hearing_loop', 'lift_access']))
      .toBe('hearing_loop, lift_access')
    expect(formatClarificationValue('accessibility_requirements', [])).toBe('None')
    expect(formatClarificationValue('registration_required', true)).toBe('Yes')
    expect(formatClarificationValue('registration_required', false)).toBe('No')
    expect(formatClarificationValue('description', null)).toBe('Not set')
    expect(formatClarificationValue('description', '')).toBe('Not set')
  })

  test('AC-037.5.22: a stored requirement code is shown as itself', () => {
    // Deliberately not translated through the catalogue: a round answered months ago may
    // name a code since retired, and a current label would be a guess about old data.
    expect(formatClarificationValue('layout_preference', 'u_shape')).toBe('u_shape')
  })

  test('AC-037.5.23: an unknown column is labelled as itself rather than hidden', () => {
    const changes = clarificationChanges({ some_new_column: 'a' }, { some_new_column: 'b' })
    expect(changes).toEqual([
      { column: 'some_new_column', label: 'some_new_column', before: 'a', after: 'b' },
    ])
  })

  test('AC-037.5.24: the revisions listed are the ones that were recorded on the way out', () => {
    // Driven by after_values: a column recorded there is a column that was submitted,
    // whatever it held beforehand — including a field that had nothing in it.
    const changes = clarificationChanges({}, { programme: 'Doors at 7' })
    expect(changes).toEqual([
      { column: 'programme', label: 'Programme', before: 'Not set', after: 'Doors at 7' },
    ])
  })
})
