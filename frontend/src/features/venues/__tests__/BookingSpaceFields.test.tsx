import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { BookingSpaceFields } from '../components/BookingSpaceFields'
import { spaceError } from '../bookingSpaceService'
const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../bookingSpaceService', async original => ({ ...await original<typeof import('../bookingSpaceService')>(), loadSpaceLayouts: mocks.load }))
beforeEach(() => { mocks.load.mockResolvedValue([{ layout: 'theatre', capacity: 50 }]) })
function Form() {
 const [value,setValue]=useState({layout:'',attendance:0})
 return <><BookingSpaceFields venueId="venue" value={value} onChange={setValue} disabled={false}/><output>{JSON.stringify(value)}</output></>
}
test('AC-049.2.30: layout and people can be recorded independently for a space', async () => {
 render(<Form/>); await screen.findByText('theatre (capacity 50)')
 fireEvent.change(screen.getByLabelText('Layout for this booking'),{target:{value:'theatre'}})
 fireEvent.change(screen.getByLabelText('People in this space'),{target:{value:'30'}})
 expect(screen.getByRole('status')).toHaveTextContent('"attendance":30')
})
test('AC-049.3.30: layout load failure is visible and disables requirements input', async () => {
 mocks.load.mockRejectedValue(new Error('offline')); render(<Form/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
 expect(screen.getByLabelText('Layout for this booking')).toBeDisabled()
})
test('AC-049.2.31: blank layout and nonpositive or fractional attendance are invalid', () => {
 for(const attendance of [0,-1,1.5,NaN]) expect(spaceError({layout:'theatre',attendance})).not.toBeNull()
 expect(spaceError({layout:'',attendance:1})).not.toBeNull()
 expect(spaceError({layout:'theatre',attendance:1})).toBeNull()
})
