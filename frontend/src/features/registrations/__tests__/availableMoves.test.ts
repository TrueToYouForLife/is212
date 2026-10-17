import { describe, expect, test } from 'vitest'
import { availableMoves } from '../validation'

/** US16 SCRUM-154: the pure rule that decides which override buttons are enabled. */
const entry = (entryId: string, status: 'waiting' | 'offered' | 'expired' = 'waiting') => ({ entryId, status })

describe('AC-016.2: which moves the Coordinator can make', () => {
  const queue = [entry('a'), entry('b'), entry('c')]

  test('AC-016.2.28: the first person in line cannot go to the front or up, but can go down', () => {
    expect(availableMoves(queue, 'a')).toEqual({ front: false, up: false, down: true })
  })

  test('AC-016.2.29: the last person cannot go down, but can go up or to the front', () => {
    expect(availableMoves(queue, 'c')).toEqual({ front: true, up: true, down: false })
  })

  test('AC-016.2.30: someone in the middle can make every move', () => {
    expect(availableMoves(queue, 'b')).toEqual({ front: true, up: true, down: true })
  })

  test('AC-016.2.31: a person alone in the queue, or an unknown id, has nothing to move to', () => {
    expect(availableMoves([entry('a')], 'a')).toEqual({ front: false, up: false, down: false })
    expect(availableMoves(queue, 'missing')).toEqual({ front: false, up: false, down: false })
  })
})

describe('AC-016.3: a held place is not part of the queue', () => {
  test('AC-016.3.27: someone holding an offer cannot move, and does not count as being ahead of anyone', () => {
    const list = [entry('held', 'offered'), entry('a'), entry('b')]
    expect(availableMoves(list, 'held')).toEqual({ front: false, up: false, down: false })
    // 'a' is first among those still waiting, even though a held place is listed above it.
    expect(availableMoves(list, 'a')).toEqual({ front: false, up: false, down: true })
  })
})

describe('AC-016.4: a lapsed offer', () => {
  test('AC-016.4.17: an offer that has expired cannot be moved either', () => {
    expect(availableMoves([entry('lapsed', 'expired'), entry('a')], 'lapsed'))
      .toEqual({ front: false, up: false, down: false })
  })
})
