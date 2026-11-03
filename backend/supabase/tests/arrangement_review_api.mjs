import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const base = process.argv[2]
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/)
const secret = 'us41-local-api-test-secret-not-a-live-credential'
const event = '41920000-0000-0000-0000-000000000001'
const emptyEvent = '41920000-0000-0000-0000-000000000002'
const coordinator = '41910000-0000-0000-0000-000000000002'
const service = readFileSync(new URL('../../../frontend/src/features/events/arrangementReviewService.ts', import.meta.url), 'utf8')
const select = service.match(/\.select\('([^']+)'\)/)?.[1]
assert.ok(select, 'Read the actual frontend select instead of maintaining a test-only copy')
const legacy = select.replace('venue_bookings!arrangement_review_flags_venue_booking_id_fkey(', 'venue_bookings(')

function token(sub) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'authenticated', sub, exp: Math.floor(Date.now() / 1000) + 300 })}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}
async function read(selection, eventId, sub) {
  const url = new URL('/arrangement_review_flags', base)
  url.search = new URLSearchParams({ select: selection, event_id: `eq.${eventId}`, order: 'created_at.desc,id.asc' })
  const response = await fetch(url, { headers: sub ? { Authorization: `Bearer ${token(sub)}` } : {} })
  return { status: response.status, body: await response.json() }
}

// Reproduce the previously shipped query against the real post-0099 relationships.
const before = await read(legacy, event, coordinator)
console.log('Prior query HTTP status:', before.status)
console.log('Prior query diagnostic:', JSON.stringify(before.body))
assert.equal(before.status, 300)
assert.equal(before.body.code, 'PGRST201')

const current = await read(select, event, coordinator)
assert.equal(current.status, 200, JSON.stringify(current.body))
assert.equal(current.body.length, 3)
const open = current.body.filter((flag) => flag.status === 'open')
const history = current.body.filter((flag) => flag.status === 'resolved')
assert.equal(open.length, 1)
assert.equal(history.length, 2)
assert.equal(open[0].venue_booking.venue.name, 'US41 Replay Hall')
const venueHistory = history.find((flag) => flag.venue_booking_id)
assert.equal(venueHistory.venue_booking_id, '41940000-0000-0000-0000-000000000001')
assert.equal(venueHistory.venue_booking.venue.name, 'US41 Replay Hall')
assert.equal(venueHistory.resolved_by, coordinator)
assert.equal(venueHistory.resolver.full_name, 'US41 Replay Coordinator')
assert.equal(venueHistory.resolution, 'Capacity checked with the organiser')
const equipment = history.find((flag) => flag.equipment_booking_id)
assert.equal(equipment.venue_booking, null)
assert.equal(equipment.resolution, 'Equipment arrangement corrected')
console.log('PASS: AC-041.1.13: API reads open venue reasons, resolved original-venue history and equipment without following the replacement FK')

assert.deepEqual(await read(select, emptyEvent, coordinator), { status: 200, body: [] })
console.log('PASS: AC-041.1.14: API returns a real empty list for an assigned event without reviews')
for (const sub of ['41910000-0000-0000-0000-000000000003', '41910000-0000-0000-0000-000000000004', '41910000-0000-0000-0000-000000000001']) {
  assert.deepEqual(await read(select, event, sub), { status: 200, body: [] })
}
const anonymous = await read(select, event)
assert.ok([401, 403].includes(anonymous.status), JSON.stringify(anonymous))
console.log('PASS: AC-041.1.15: unassigned Coordinator, Venue Staff, Organiser and anonymous cannot read protected reviews')
