import { test, expect } from 'vitest'
import { solve } from './bridges-solver'
import { growBoard, isSolved, makePuzzle, pairBetween, type Puzzle } from './bridges-logic'

function seeded(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An independent check: try every level on every pair, cutting off a branch once an island goes over, and
// count the solutions that are solved.
function countSolutions(puzzle: Puzzle, stopAt = 2): number {
  const levels = puzzle.pairs.map(() => 0)
  const used = puzzle.islands.map(() => 0)
  let count = 0

  function place(p: number): void {
    if (count >= stopAt) return

    if (p === puzzle.pairs.length) {
      if (isSolved(puzzle, levels)) count += 1
      return
    }

    const { a, b } = puzzle.pairs[p]

    for (let level = 0; level <= 2; level += 1) {
      if (used[a] + level > puzzle.islands[a].count || used[b] + level > puzzle.islands[b].count) break
      if (level > 0 && puzzle.crossings[p].some((q) => q < p && levels[q] > 0)) break

      levels[p] = level
      used[a] += level
      used[b] += level
      place(p + 1)
      used[a] -= level
      used[b] -= level
    }

    levels[p] = 0
  }

  place(0)
  return count
}

//   1 . 1
//   . . .
//   2 . 2
const SQUARE = makePuzzle(3, [
  { row: 0, col: 0, count: 1 },
  { row: 0, col: 2, count: 1 },
  { row: 2, col: 0, count: 2 },
  { row: 2, col: 2, count: 2 },
])

test('a 1 never joins a 1 while other islands are left, so the square has one solution', () => {
  const result = solve(SQUARE)

  expect(result.status).toBe('solved')
  expect(result.lower[pairBetween(SQUARE, 0, 1)]).toBe(0)
  expect(result.lower[pairBetween(SQUARE, 0, 2)]).toBe(1)
  expect(result.lower[pairBetween(SQUARE, 2, 3)]).toBe(1)
})

test('two 2s never take a double bridge between them while other islands are left', () => {
  //   2 . 2
  //   . . .
  //   3 . 3
  // That leaves two solutions, so the solver gets stuck rather than guessing.
  const puzzle = makePuzzle(3, [
    { row: 0, col: 0, count: 2 },
    { row: 0, col: 2, count: 2 },
    { row: 2, col: 0, count: 3 },
    { row: 2, col: 2, count: 3 },
  ])
  const result = solve(puzzle)

  expect(result.status).toBe('stuck')
  expect(result.upper[pairBetween(puzzle, 0, 1)]).toBe(1)
  expect(countSolutions(puzzle)).toBe(2)
})

test('two 2s never take a double bridge between them, even before any other rule bounds the pair', () => {
  //   2 . 2
  //   . . .
  //   2 . 2
  // A double bridge on any side would close off two done islands, so every side has one bridge.
  const puzzle = makePuzzle(3, [
    { row: 0, col: 0, count: 2 },
    { row: 0, col: 2, count: 2 },
    { row: 2, col: 0, count: 2 },
    { row: 2, col: 2, count: 2 },
  ])
  const result = solve(puzzle)

  expect(result.status).toBe('solved')
  expect(result.lower).toEqual(puzzle.pairs.map(() => 1))
  expect(countSolutions(puzzle)).toBe(1)
})

test('an island’s count forces bridges when its other pairs can’t make it up', () => {
  //   1 . 3 . .
  //   . . . . .
  //   . . 2 . .
  const puzzle = makePuzzle(5, [
    { row: 0, col: 0, count: 1 },
    { row: 0, col: 2, count: 3 },
    { row: 2, col: 2, count: 2 },
  ])
  const result = solve(puzzle)

  expect(result.status).toBe('solved')
  expect(result.lower).toEqual([1, 2])
})

//   . . 1 . .
//   . . . . .
//   1 . . . 1
//   . . . . .
//   . . 1 . .
const PLUS = makePuzzle(5, [
  { row: 0, col: 2, count: 1 },
  { row: 2, col: 0, count: 1 },
  { row: 2, col: 4, count: 1 },
  { row: 4, col: 2, count: 1 },
])

test('a pair that must have a bridge rules out the pairs crossing it', () => {
  const across = pairBetween(PLUS, 1, 2)
  const down = pairBetween(PLUS, 0, 3)
  const givens = PLUS.pairs.map((_, p) => (p === across ? 1 : 0))

  expect(solve(PLUS, givens).upper[down]).toBe(0)
})

test('a board with no solution is a contradiction', () => {
  expect(solve(PLUS).status).toBe('contradiction')
})

test('givens are a floor: a pair given one bridge can still be found to need two', () => {
  //   2 . .
  //   . . .
  //   3 . 1
  const puzzle = makePuzzle(3, [
    { row: 0, col: 0, count: 2 },
    { row: 2, col: 0, count: 3 },
    { row: 2, col: 2, count: 1 },
  ])
  const left = pairBetween(puzzle, 0, 1)
  const result = solve(
    puzzle,
    puzzle.pairs.map((_, p) => (p === left ? 1 : 0)),
  )

  expect(result.status).toBe('solved')
  expect(result.lower[left]).toBe(2)
  expect(result.settledOnPass[left]).toBeGreaterThan(0)
})

test('whenever the solver solves a grown board, its solution is the one grown and the only one', () => {
  let solved = 0

  for (let seed = 1; seed <= 40; seed += 1) {
    const { puzzle, solution } = growBoard(7, seeded(seed))
    const result = solve(puzzle)

    if (result.status === 'solved') {
      solved += 1
      expect(result.lower).toEqual(solution)
      expect(countSolutions(puzzle)).toBe(1)
    } else {
      expect(result.status).toBe('stuck') // a grown board always has a solution
    }
  }

  expect(solved).toBeGreaterThan(10)
})

test('the solver never contradicts a grown board’s own solution, at any size', () => {
  for (const size of [10, 13]) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { puzzle, solution } = growBoard(size, seeded(seed))
      const result = solve(puzzle)

      expect(result.status).not.toBe('contradiction')
      result.lower.forEach((level, p) => {
        expect(level).toBeLessThanOrEqual(solution[p])
        expect(result.upper[p]).toBeGreaterThanOrEqual(solution[p])
      })
    }
  }
})
