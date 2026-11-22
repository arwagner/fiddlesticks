import { test, expect } from 'vitest'
import { shuffled } from './shuffle'

test('shuffled keeps every value and leaves the input as it was', () => {
  const values = [1, 2, 3, 4, 5, 6]
  const result = shuffled(values, () => 0.3)

  expect([...result].sort()).toEqual(values)
  expect(values).toEqual([1, 2, 3, 4, 5, 6])
})

test('shuffled keeps the order when random never swaps', () => {
  expect(shuffled(['a', 'b', 'c', 'd'], () => 0.999999)).toEqual(['a', 'b', 'c', 'd'])
})

test('shuffled swaps each place with the one random picks', () => {
  // random 0 always swaps with the first place: [a,b,c] → [c,b,a] → [b,c,a]
  expect(shuffled(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a'])
})
