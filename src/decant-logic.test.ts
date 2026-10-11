import { test, expect } from 'vitest'
import {
  topRun,
  freeSpace,
  pourAmount,
  applyPour,
  legalMoves,
  isSolved,
  pour,
  undo,
  newGameFromBottles,
  dealBottles,
  newGame,
} from './decant-logic'

// A deterministic stand-in for Math.random, so a deal has a known outcome.
function seeded(seed: number): () => number {
  let value = seed

  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

test('topRun reads the unbroken run of one color at the top of a bottle', () => {
  expect(topRun([])).toBeNull()
  expect(topRun([0, 1, 1, 1])).toEqual({ color: 1, count: 3 })
  expect(topRun([2, 2, 2])).toEqual({ color: 2, count: 3 })
  expect(topRun([1, 1, 0])).toEqual({ color: 0, count: 1 })
})

test('freeSpace counts the layers a bottle can still take', () => {
  expect(freeSpace([], 5)).toBe(5)
  expect(freeSpace([0, 0, 0, 0, 0], 5)).toBe(0)
  expect(freeSpace([0, 1], 5)).toBe(3)
})

test('a pour moves the whole matching run into an empty bottle', () => {
  expect(pourAmount([0, 1, 1, 1], [], 5)).toBe(3)
})

test('a pour needs the destination top to match the color being poured', () => {
  expect(pourAmount([0, 1, 1], [2, 2], 5)).toBe(0)
  expect(pourAmount([0, 1, 1], [2, 1], 5)).toBe(2)
})

test('a pour stops at the destination rim, leaving the rest behind', () => {
  // three red on top, room for two: pour two and leave one.
  expect(pourAmount([0, 1, 1, 1], [1, 1, 1], 5)).toBe(2)
  expect(applyPour([[0, 1, 1, 1], [1, 1, 1]], { from: 0, to: 1 }, 5)).toEqual([
    [0, 1],
    [1, 1, 1, 1, 1],
  ])
})

test('nothing pours out of an empty bottle or into a full one', () => {
  expect(pourAmount([], [1], 5)).toBe(0)
  expect(pourAmount([1], [1, 1, 1, 1, 1], 5)).toBe(0)
})

test('applyPour leaves the bottles it was given untouched', () => {
  const bottles = [
    [0, 0],
    [1, 0],
  ]
  const next = applyPour(bottles, { from: 1, to: 0 }, 5)

  expect(next).toEqual([[0, 0, 0], [1]])
  expect(bottles).toEqual([
    [0, 0],
    [1, 0],
  ])
})

test('applyPour refuses an illegal move, including a bottle onto itself', () => {
  expect(applyPour([[0], [1]], { from: 0, to: 1 }, 5)).toBeNull()
  expect(applyPour([[0], [1]], { from: 0, to: 0 }, 5)).toBeNull()
})

test('legalMoves lists every pour available and nothing else', () => {
  const bottles = [[0, 1], [1], []]

  expect(legalMoves(bottles, 5)).toEqual([
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 0 },
    { from: 1, to: 2 },
  ])
})

test('the game is solved when every bottle is empty or full of one color', () => {
  expect(isSolved([[0, 0, 0], [1, 1, 1], []], 3)).toBe(true)
  expect(isSolved([[0, 1, 0], [1, 1, 1], []], 3)).toBe(false) // two colors in a bottle
  expect(isSolved([[0, 0], [1, 1, 1], [0]], 3)).toBe(false) // one color, but split and short of the rim
})

test('pour advances the game and records the move', () => {
  const start = newGameFromBottles([[0], [0], []], 2)
  const next = pour(start, 0, 1)

  expect(next.bottles).toEqual([[], [0, 0], []])
  expect(next.moves).toBe(1)
  expect(next.won).toBe(true)
  expect(start.bottles).toEqual([[0], [0], []]) // the old state is untouched
})

test('an illegal pour returns the same state object, so the view can skip a redraw', () => {
  const start = newGameFromBottles([[0, 1], [0], []], 2)

  expect(pour(start, 0, 1)).toBe(start) // top colors disagree
  expect(pour(start, 0, 0)).toBe(start) // a bottle cannot pour into itself
})

test('a solved board takes no more pours', () => {
  const won = pour(newGameFromBottles([[0], [0], []], 2), 0, 1)

  expect(won.won).toBe(true)
  expect(pour(won, 1, 2)).toBe(won)
})

test('undo walks back through every move, and stops at the deal', () => {
  const start = newGameFromBottles([[1, 0], [0, 1], []], 2)
  const played = pour(pour(start, 0, 2), 1, 0)

  expect(played.moves).toBe(2)
  expect(played.bottles).toEqual([[1, 1], [0], [0]])
  expect(undo(played).bottles).toEqual([[1], [0, 1], [0]])
  const backAtTheDeal = undo(undo(played))

  expect(backAtTheDeal.bottles).toEqual(start.bottles)
  expect(backAtTheDeal.moves).toBe(0)
  expect(undo(backAtTheDeal)).toBe(backAtTheDeal) // nothing left to undo
})

test('a win taken back by undo is a win no longer', () => {
  const start = newGameFromBottles([[0], [0], []], 2)
  const won = pour(start, 0, 1)

  expect(won.won).toBe(true)
  expect(undo(won).won).toBe(false)
})

test('dealBottles fills one bottle per color and leaves the empties empty', () => {
  const bottles = dealBottles({ colors: 4, capacity: 5, empties: 2 }, seeded(7))

  expect(bottles.length).toBe(6)
  expect(bottles.slice(0, 4).every((bottle) => bottle.length === 5)).toBe(true)
  expect(bottles.slice(4)).toEqual([[], []])

  const counts = new Map<number, number>()
  for (const color of bottles.flat()) {
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  expect([...counts.entries()].sort()).toEqual([
    [0, 5],
    [1, 5],
    [2, 5],
    [3, 5],
  ])
})

test('newGame deals a puzzle that can be solved, and takes at least minMoves to solve', () => {
  const game = newGame({ colors: 3, capacity: 3, empties: 1, minMoves: 6 }, seeded(3))

  expect(game.capacity).toBe(3)
  expect(game.bottles.length).toBe(4)
  expect(game.won).toBe(false)
  expect(game.par).not.toBeNull()
  expect(game.par!).toBeGreaterThanOrEqual(6)
})
