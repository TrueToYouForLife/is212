import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { VenueFilters } from '../components/VenueFilters'
import type { AssignedEventOption, VenueSearchFilters } from '../types'

const emptyFilters: VenueSearchFilters = {
  keyword: '', location: '', minAttendance: '', layout: '',
  accessibility: [], facilities: [], date: '', slot: '', eventId: '',
}

const LAYOUTS = [
  { code: 'theatre', label: 'Theatre' },
  { code: 'banquet', label: 'Banquet (rounds)' },
]

const EVENT: AssignedEventOption = {
  id: 'event-1',
  reference: 'EVT-2026-0001',
  name: 'Client dinner',
  proposedStart: '2099-06-01T10:00:00Z',
  proposedEnd: '2099-06-01T14:00:00Z',
  expectedAttendance: 180,
  layoutPreference: 'banquet',
  accessibilityRequirements: ['wheelchair_access', 'lift_access'],
  facilityRequirements: ['projector'],
  equipmentRequirements: ['wireless_mic'],
}

function setup(filters: VenueSearchFilters = emptyFilters, events: AssignedEventOption[] = [EVENT]) {
  const onChange = vi.fn()
  render(
    <VenueFilters
      filters={filters}
      onChange={onChange}
      onSearch={vi.fn()}
      onClear={vi.fn()}
      assignedEvents={events}
      layoutTypes={LAYOUTS}
      disabled={false}
    />,
  )
  return { onChange }
}

/**
 * All of this file is AC-008.3 — filtering by event requirements. .3.1–.3.6 cover applying
 * a selected event's requirements to the filters; .3.7–.3.9 cover choosing the layout from
 * the catalogue, which is the "supported layout" part of the same criterion.
 */
describe("AC-008.3 — choosing an event applies its requirements to the filters", () => {
  test("AC-008.3.1: the event's layout, accessibility and facilities become the filters", () => {
    // This is only possible because the event stores the same catalogue codes the filters
    // use (0054). Previously these were free text and the coordinator had to read them
    // and tick the matching boxes by hand, which is where a requirement got lost.
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Search for one of your events'), {
      target: { value: 'event-1' },
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      layout: 'banquet',
      accessibility: ['wheelchair_access', 'lift_access'],
      facilities: ['projector'],
      minAttendance: '180',
    }))
  })

  test("AC-008.3.2: the event's date and slot filters are cleared, since the event sets them", () => {
    const { onChange } = setup({ ...emptyFilters, date: '2026-10-12', slot: 'AM' })
    fireEvent.change(screen.getByLabelText('Search for one of your events'), {
      target: { value: 'event-1' },
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date: '', slot: '' }))
  })

  test('AC-008.3.3: the applied requirements are copied, not shared with the event', () => {
    // The coordinator can untick one to widen a search; that must not edit the event.
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Search for one of your events'), {
      target: { value: 'event-1' },
    })
    const applied = onChange.mock.calls[0][0] as VenueSearchFilters
    expect(applied.accessibility).not.toBe(EVENT.accessibilityRequirements)
    expect(applied.facilities).not.toBe(EVENT.facilityRequirements)
  })

  test('AC-008.3.4: going back to a manual search only clears the event', () => {
    // Widening a search and then clearing the event should not silently undo the widening.
    const { onChange } = setup({
      ...emptyFilters, eventId: 'event-1', layout: 'banquet', accessibility: ['lift_access'],
    })
    fireEvent.change(screen.getByLabelText('Search for one of your events'), {
      target: { value: '' },
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      eventId: '', layout: 'banquet', accessibility: ['lift_access'],
    }))
  })

  test('AC-008.3.5: the coordinator is told the requirements were applied and can be widened', () => {
    setup({ ...emptyFilters, eventId: 'event-1' })
    expect(screen.getByText(/requirements have been applied to the filters/i)).toBeInTheDocument()
    expect(screen.getByText(/untick a requirement below to widen the search/i)).toBeInTheDocument()
  })

  test('AC-008.3.6: equipment is shown as reserved separately, not applied as a filter', () => {
    // A venue has facilities; portable equipment is reserved through US13/US14, so it is
    // not a property anything here can filter on.
    setup({ ...emptyFilters, eventId: 'event-1' })
    expect(screen.getByText(/reserved separately, so.*it is not a venue filter/is))
      .toBeInTheDocument()
  })
})

describe('AC-008.3 — layout is chosen from the catalogue, not typed', () => {
  test('AC-008.3.7: every layout in the catalogue is offered, plus "any layout"', () => {
    setup()
    const select = screen.getByLabelText('Layout')
    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(screen.getByRole('option', { name: 'Any layout' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Theatre' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Banquet (rounds)' })).toBeInTheDocument()
  })

  test('AC-008.3.8: choosing a layout sets its code, not its label', () => {
    const { onChange } = setup()
    fireEvent.change(screen.getByLabelText('Layout'), { target: { value: 'theatre' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layout: 'theatre' }))
  })

  test('AC-008.3.9: a layout the catalogue no longer lists stays selectable', () => {
    // An event may ask for a retired layout; dropping it from the dropdown would silently
    // widen the search without telling the coordinator their requirement was discarded.
    setup({ ...emptyFilters, layout: 'cabaret' })
    expect(screen.getByLabelText('Layout')).toHaveValue('cabaret')
    expect(screen.getByRole('option', { name: 'cabaret' })).toBeInTheDocument()
  })
})
