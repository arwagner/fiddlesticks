import { test, expect } from 'vitest'
import { isDeducible } from './pipes-solver'
import { generateTree, newGame, isSolved, rotateCW, sourceFor, N, E, S, W } from './pipes-logic'
const SIZES = [5, 7, 9, 12, 15]

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

// An independent check: try every rotation of every tile and count the boards that are solved.
function countSolutions(tiles: number[][]): number {
  const size = tiles.length
  const board = tiles.map((row) => row.map(() => 0))
  let count = 0

  function rotations(mask: number): number[] {
    const seen = new Set<number>()
    for (let m = mask, i = 0; i < 4; i += 1, m = rotateCW(m)) seen.add(m)
    return [...seen]
  }

  function place(index: number): void {
    if (index === size * size) {
      if (isSolved(board, sourceFor(size))) count += 1
      return
    }

    const r = Math.floor(index / size)
    const c = index % size

    for (const mask of rotations(tiles[r][c])) {
      if (r === 0 && mask & N) continue
      if (c === 0 && mask & W) continue
      if (r === size - 1 && mask & S) continue
      if (c === size - 1 && mask & E) continue
      if (r > 0 && Boolean(mask & N) !== Boolean(board[r - 1][c] & S)) continue
      if (c > 0 && Boolean(mask & W) !== Boolean(board[r][c - 1] & E)) continue
      board[r][c] = mask
      place(index + 1)
    }
  }

  place(0)
  return count
}

test('a board the solver finishes has exactly one solution, and one with two is never deducible', () => {
  let ambiguous = 0
  let deducible = 0

  for (let seed = 1; seed <= 150; seed += 1) {
    const tree = generateTree(4, seeded(seed))
    const solutions = countSolutions(tree)

    if (isDeducible(tree)) {
      deducible += 1
      expect(solutions).toBe(1)
    }

    if (solutions > 1) {
      ambiguous += 1
      expect(isDeducible(tree)).toBe(false)
    }
  }

  expect(ambiguous).toBeGreaterThan(0) // the check above actually ran
  expect(deducible).toBeGreaterThan(100)
})

// Edge forcing alone finishes about 5% of random 12×12 trees. Loop and dead-end avoidance lift that to about
// half (Net, measured in the Pipes research), so a high rate here means the global rules are doing their job.
test('the solver finishes about half of random 12×12 trees', () => {
  let finished = 0

  for (let seed = 1; seed <= 200; seed += 1) {
    if (isDeducible(generateTree(12, seeded(seed)))) finished += 1
  }

  expect(finished).toBeGreaterThan(70)
})

test('every dealt game, at every size, is deducible', () => {
  for (const size of SIZES) {
    for (let seed = 1; seed <= 200; seed += 1) {
      expect(isDeducible(newGame(size, seeded(seed * 97 + size)).solution)).toBe(true)
    }
  }
})

test('a 15×15 game deals well inside 10ms', () => {
  const random = seeded(7)
  newGame(15, random) // warm up
  const started = performance.now()

  for (let i = 0; i < 20; i += 1) newGame(15, random)

  expect((performance.now() - started) / 20).toBeLessThan(10)
})
