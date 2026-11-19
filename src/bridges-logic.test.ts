import { test, expect } from 'vitest'
import {
  makePuzzle,
  findPairs,
  bridgeCounts,
  islandStatuses,
  isSolved,
  isDeducible,
  growBoard,
  generateSolvableBoard,
  targetIslands,
  newGame,
  newGameFromBoard,
  cycle,
  undo,
  findHints,
  applyHint,
  pairBetween,
  type Island,
} from './bridges-logic'

// A small seeded generator, so random deals repeat exactly.
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

// Four islands at the corners of a square:
//   1 . 1
//   . . .
//   2 . 2
// The top two can't join each other, or they'd be closed off, so the only solution is a U.
const SQUARE: Island[] = [
  { row: 0, col: 0, count: 1 },
  { row: 0, col: 2, count: 1 },
  { row: 2, col: 0, count: 2 },
  { row: 2, col: 2, count: 2 },
]
const square = makePuzzle(3, SQUARE)
const TOP = pairBetween(square, 0, 1)
const LEFT = pairBetween(square, 0, 2)
const RIGHT = pairBetween(square, 1, 3)
const BOTTOM = pairBetween(square, 2, 3)

function levelsOf(entries: [number, number][], pairs = square.pairs.length): number[] {
  const levels = new Array<number>(pairs).fill(0)
  entries.forEach(([pair, level]) => (levels[pair] = level))
  return levels
}

const SOLUTION = levelsOf([
  [LEFT, 1],
  [RIGHT, 1],
  [BOTTOM, 1],
])

// A plus: the bridge across and the bridge down would cross in the middle.
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
const ACROSS = pairBetween(PLUS, 1, 2)
const DOWN = pairBetween(PLUS, 0, 3)

test('neighbours are the nearest islands in each row and column, each pair found once', () => {
  expect(square.pairs).toHaveLength(4)
  expect(square.pairs[TOP]).toEqual({ a: 0, b: 1, orientation: 'across' })
  expect(square.pairs[LEFT]).toEqual({ a: 0, b: 2, orientation: 'down' })
  expect(pairBetween(square, 0, 3)).toBe(-1) // diagonal islands are not neighbours
})

test('an island in between makes the far island no longer a neighbour', () => {
  const pairs = findPairs(5, [
    { row: 0, col: 0, count: 1 },
    { row: 0, col: 2, count: 2 },
    { row: 0, col: 4, count: 1 },
  ])

  expect(pairs.map(({ a, b }) => [a, b])).toEqual([
    [0, 1],
    [1, 2],
  ])
})

test('a bridge across and a bridge down that pass through each other cross; ones meeting at an island don’t', () => {
  expect(PLUS.crossings[ACROSS]).toEqual([DOWN])
  expect(PLUS.crossings[DOWN]).toEqual([ACROSS])
  expect(square.crossings.every((crossing) => crossing.length === 0)).toBe(true)
})

test('an island is done at its count and over past it', () => {
  const levels = levelsOf([
    [TOP, 2],
    [LEFT, 1],
  ])

  expect(bridgeCounts(square, levels)).toEqual([3, 2, 1, 0])
  expect(islandStatuses(square, levels)).toEqual(['over', 'over', 'open', 'open'])
  expect(islandStatuses(square, SOLUTION)).toEqual(['done', 'done', 'done', 'done'])
})

test('solved needs every island done and every island connected', () => {
  expect(isSolved(square, SOLUTION)).toBe(true)

  // Every island done, but in two separate groups.
  const twoGroups = makePuzzle(5, [
    { row: 0, col: 0, count: 1 },
    { row: 0, col: 2, count: 1 },
    { row: 4, col: 4, count: 1 },
    { row: 4, col: 2, count: 1 },
  ])
  const levels = twoGroups.pairs.map(({ a, b }) => (a + b === 1 || a + b === 5 ? 1 : 0))

  expect(islandStatuses(twoGroups, levels).every((status) => status === 'done')).toBe(true)
  expect(isSolved(twoGroups, levels)).toBe(false)
})

test('a move cycles a pair 0, 1, 2 and back to 0, each one undoable', () => {
  const dealt = newGameFromBoard(square, SOLUTION)
  const one = cycle(dealt, TOP)
  const two = cycle(one, TOP)
  const none = cycle(two, TOP)

  expect([one.levels[TOP], two.levels[TOP], none.levels[TOP]]).toEqual([1, 2, 0])
  expect(none.past).toHaveLength(3)
  expect(undo(none).levels[TOP]).toBe(2)
  expect(undo(undo(undo(none))).levels).toEqual(dealt.levels)
})

test('undo with nothing to take back changes nothing', () => {
  const dealt = newGameFromBoard(square, SOLUTION)

  expect(undo(dealt)).toBe(dealt)
})

test('a bridge that would cross another is refused, returning the same state', () => {
  const crossed = cycle(newGameFromBoard(PLUS, [0, 0]), ACROSS)

  expect(cycle(crossed, DOWN)).toBe(crossed)
})

test('the last bridge solves the board, and then it takes no more moves or undos', () => {
  let state = newGameFromBoard(square, SOLUTION)
  state = cycle(cycle(state, LEFT), RIGHT)
  expect(state.solved).toBe(false)

  state = cycle(state, BOTTOM)
  expect(state.solved).toBe(true)
  expect(cycle(state, TOP)).toBe(state)
  expect(undo(state)).toBe(state)
})

test('a grown board keeps islands apart, counts every bridge, and its solution is solved', () => {
  for (const size of [7, 10, 13]) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { puzzle, solution } = growBoard(size, seeded(seed * size))
      const taken = new Set(puzzle.islands.map(({ row, col }) => row * size + col))

      expect(isSolved(puzzle, solution)).toBe(true)
      expect(bridgeCounts(puzzle, solution)).toEqual(puzzle.islands.map((island) => island.count))
      expect(puzzle.islands.every(({ count }) => count >= 1 && count <= 8)).toBe(true)

      for (const { row, col } of puzzle.islands) {
        expect(taken.has(row * size + col + 1) && col + 1 < size).toBe(false)
        expect(taken.has((row + 1) * size + col)).toBe(false)
      }
    }
  }
})

test('boards come close to a fifth of the cells as islands', () => {
  for (const size of [7, 10, 13]) {
    const islands = [1, 2, 3, 4, 5].map((seed) => growBoard(size, seeded(seed)).puzzle.islands.length)
    const average = islands.reduce((sum, n) => sum + n, 0) / islands.length

    expect(average).toBeGreaterThan(targetIslands(size) * 0.8)
    expect(Math.max(...islands)).toBeLessThanOrEqual(targetIslands(size))
  }
})

test('the same random numbers grow the same board', () => {
  expect(growBoard(10, seeded(42))).toEqual(growBoard(10, seeded(42)))
})

test('a dealt board can be solved by deduction alone, and starts with no bridges', () => {
  for (const size of [7, 10, 13]) {
    const state = newGame(size, seeded(size))

    expect(isDeducible(state.puzzle)).toBe(true)
    expect(state.levels.every((level) => level === 0)).toBe(true)
    expect(state.solved).toBe(false)
  }
})

test('when it runs out of attempts, generation keeps the last board grown, deducible or not', () => {
  const random = seeded(7)
  const board = generateSolvableBoard(7, random, 1)

  expect(board).toEqual(growBoard(7, seeded(7)))
})

// Measured: a board grows and is checked in well under a millisecond, and a third to two thirds pass, so a
// deal takes a few milliseconds at the most. The cap leaves plenty of room for a slow machine.
test('a deal at every size takes well under a second', () => {
  for (const size of [7, 10, 13]) {
    for (let seed = 1; seed <= 10; seed += 1) {
      const start = performance.now()
      newGame(size, seeded(seed))
      expect(performance.now() - start).toBeLessThan(250)
    }
  }
})

test('Hint points out a pair with more bridges than the solution, and changes nothing', () => {
  const state = cycle(newGameFromBoard(square, SOLUTION), TOP)
  const hints = findHints(state)

  expect(hints).toEqual([{ type: 'wrong', pair: TOP }])
  expect(applyHint(state, hints[0])).toBe(state)
})

test('a pair with fewer bridges than the solution is short, not wrong', () => {
  const lShape = makePuzzle(3, [
    { row: 0, col: 0, count: 2 },
    { row: 2, col: 0, count: 3 },
    { row: 2, col: 2, count: 1 },
  ])
  const left = pairBetween(lShape, 0, 1)
  // The solution: two bridges down the left and one along the bottom. One bridge down the left is short.
  const state = cycle(newGameFromBoard(lShape, [2, 1]), left)

  expect(findHints(state).map((hint) => hint.type)).not.toContain('wrong')
  expect(findHints(state)).toContainEqual({ type: 'fix', pair: left, level: 2 })
})

test('Hint settles one pair as one undoable step, and enough of them solve the board', () => {
  let state = newGameFromBoard(square, SOLUTION)
  const first = findHints(state)[0]

  state = applyHint(state, first)
  expect(state.past).toHaveLength(1)
  expect(state.levels[first.pair]).toBe(SOLUTION[first.pair])

  for (let i = 0; i < 4 && !state.solved; i += 1) state = applyHint(state, findHints(state)[0])

  expect(state.solved).toBe(true)
  expect(findHints(state)).toEqual([])
})

test('Hint finishes a dealt board at every size', () => {
  for (const size of [7, 10, 13]) {
    let state = newGame(size, seeded(size + 100))

    for (let i = 0; i < state.puzzle.pairs.length && !state.solved; i += 1) {
      const hints = findHints(state)
      expect(hints.length).toBeGreaterThan(0)
      expect(hints[0].type).toBe('fix')
      state = applyHint(state, hints[0])
    }

    expect(state.solved).toBe(true)
  }
})
