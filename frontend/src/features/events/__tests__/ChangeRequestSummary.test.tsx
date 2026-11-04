import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ChangeRequestSummary } from '../components/ChangeRequestSummary'
import { changeRequest } from './fixtures/changeRequestReview'
import type { EventChangeRequest } from '../types'

test('AC-007.13.32: saved notes remain visible and provisional field decisions become final only after review completes', () => {
  const request: EventChangeRequest = {
    ...changeRequest, status: 'clarification_requested', reviewNote: 'Retain the published capacity.',
    proposedChanges: { name: 'New title', expectedAttendance: '80', programme: 'Arrival and introductions' },
    fieldDecisions: [
      { field: 'name', decision: 'approved', note: '' },
      { field: 'expectedAttendance', decision: 'rejected', note: 'Capacity remains 50.' },
      { field: 'programme', decision: 'clarification_requested', note: 'When does the introduction end?' },
    ],
    replyHistory: [],
  }
  const view = render(<ChangeRequestSummary request={request} />)
  const fields = screen.getAllByRole('listitem')
  expect(within(fields[0]).getByText('Approved provisionally')).toBeInTheDocument()
  expect(within(fields[1]).getByText('Rejected provisionally')).toBeInTheDocument()
  expect(within(fields[1]).getByText('Capacity remains 50.')).toBeInTheDocument()
  expect(within(fields[2]).getByText('Clarification required')).toBeInTheDocument()
  expect(within(fields[2]).getByText('When does the introduction end?')).toBeInTheDocument()
  expect(screen.getByText('Retain the published capacity.')).toBeInTheDocument()
  expect(screen.getByText(/No proposed changes have been applied/)).toBeInTheDocument()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()

  view.rerender(<ChangeRequestSummary request={{ ...request, status: 'partially_approved',
    fieldDecisions: [...request.fieldDecisions.slice(0, 2), { field: 'programme', decision: 'approved', note: '' }],
  }} />)
  const finalFields = screen.getAllByRole('listitem')
  expect(within(finalFields[0]).getByText('Approved')).toBeInTheDocument()
  expect(within(finalFields[1]).getByText('Rejected')).toBeInTheDocument()
  expect(within(finalFields[2]).getByText('Approved')).toBeInTheDocument()
  expect(screen.queryByText(/provisionally/)).not.toBeInTheDocument()
  expect(screen.queryByText(/No proposed changes have been applied/)).not.toBeInTheDocument()
  expect(screen.getByText('Capacity remains 50.')).toBeInTheDocument()
  expect(screen.getByText('Retain the published capacity.')).toBeInTheDocument()
})
