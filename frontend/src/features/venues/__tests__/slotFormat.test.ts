import { expect, test } from 'vitest'
import { formatPlainDate } from '../slotFormat'

test.each([
  ['2041-03-10', '10 Mar 2041'],
  ['2041-01-01', '1 Jan 2041'],
  ['2041-12-31', '31 Dec 2041'],
  ['not a date', 'not a date'],
  ['2041-00-10', '2041-00-10'],
  ['2041-13-10', '2041-13-10'],
])('formats calendar dates and preserves unsupported input: %s', (input, expected) => {
  expect(formatPlainDate(input)).toBe(expected)
})
