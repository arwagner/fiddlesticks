import { test, expect } from 'vitest'
import { solve, runCount } from './decant-solver'
import { applyPour, isSolved, dealBottles, type Bottle, type Move } from './decant-logic'

function play(bottles: Bottle[], moves: Move[], capacity: number): Bottle[] {
  return moves.reduce<Bottle[]>((current, move) => {
    const next = applyPour(current, move, capacity)

    if (!next) {
      throw new Error(`Illegal move in solution: ${move.from} -> ${move.to}`)
    }

    return next
  }, bottles)
}

test('runCount counts the bands of color a bottle shows', () => {
  expect(runCount([])).toBe(0)
  expect(runCount([0, 0, 0])).toBe(1)
  expect(runCount([0, 1, 1, 0])).toBe(3)
})

test('a board already solved needs no moves', () => {
  expect(solve([[0, 0], [1, 1], []], 2)).toEqual([])
})

test('the solver finds the shortest way home', () => {
  // Hand-checked: two pours can leave every bottle one color, but not one color to the rim. Three can.
  expect(solve([[0, 1], [1, 0], []], 2)).toHaveLength(3)
})

test('a board with no legal move at all comes back unsolved', () => {
  expect(
    solve(
      [
        [0, 1],
        [1, 0],
      ],
      2,
    ),
  ).toBeNull()
})

test('the solver gives up rather than searching forever', () => {
  const bottles = [[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2], []]

  expect(solve(bottles, 4, 5)).toBeNull()
})

test('every move the solver returns is legal, and the last one wins the game', () => {
  const bottles = dealBottles({ colors: 4, capacity: 4, empties: 2 }, Math.random)
  const moves = solve(bottles, 4)

  expect(moves).not.toBeNull()
  expect(isSolved(play(bottles, moves!, 4), 4)).toBe(true)
})
