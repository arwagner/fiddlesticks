import { test, expect } from 'vitest'
import {
  N, E, S, W, rotateCW, kindOf, lightDepths, looseEnds, isSolved, armCount,
  newGameFromBoards, newGame, generateTree, scramble, rotate, toggleLock, undo } from './pipes-logic'

test('four clockwise turns bring a tile back to where it started', () => {
  expect(rotateCW(N)).toBe(E)
  expect(rotateCW(W)).toBe(N)
  expect(rotateCW(N | E)).toBe(E | S)
  expect(rotateCW(rotateCW(rotateCW(rotateCW(N | E | W))))).toBe(N | E | W)
})

test('a tile’s kind comes from its arms', () => {
  expect(kindOf(S)).toBe('end')
  expect(kindOf(N | S)).toBe('straight')
  expect(kindOf(E | W)).toBe('straight')
  expect(kindOf(N | E)).toBe('corner')
  expect(kindOf(S | W)).toBe('corner')
  expect(kindOf(N | E | S)).toBe('tee')
})

// A 3×3 answer: end–tee–end across the top, a tee in the middle, and a chain round the bottom right.
//   (0,0)E  (0,1)WES  (0,2)W
//   (1,0)E  (1,1)NWS  (1,2)S
//   (2,0)E  (2,1)NWE  (2,2)WN
const TREE: number[][] = [
  [E, W | E | S, W],
  [E, N | W | S, S],
  [E, N | W | E, W | N],
]
const CENTRE = { r: 1, c: 1 }

test('lighting spreads from the source through joins, counting steps', () => {
  expect(lightDepths(TREE, CENTRE)).toEqual([
    [2, 1, 2],
    [1, 0, 3],
    [2, 1, 2],
  ])
})

test('a tile cut off from the source is unlit', () => {
  const board = TREE.map((row) => [...row])
  board[0][0] = N // turned away from its neighbour

  expect(lightDepths(board, CENTRE)[0][0]).toBe(-1)
  expect(lightDepths(board, CENTRE)[0][1]).toBe(1)
})

test('an arm with no join is a loose end, including one facing the board edge', () => {
  expect(looseEnds(TREE)).toBe(0)

  const board = TREE.map((row) => [...row])
  board[0][0] = N // faces the top edge, and leaves the tee's west arm hanging

  expect(looseEnds(board)).toBe(2)
})

test('the answer is solved', () => {
  expect(isSolved(TREE, CENTRE)).toBe(true)
})

test('no loose ends is not enough: a loop plus a separate island is not solved', () => {
  const loopAndIsland: number[][] = [
    [E | S, W | S, S],
    [N | E, N | W, N | S],
    [E, E | W, N | W],
  ]

  expect(looseEnds(loopAndIsland)).toBe(0)
  expect(isSolved(loopAndIsland, CENTRE)).toBe(false)
})

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

function withTurned(board: number[][], r: number, c: number): number[][] {
  const copy = board.map((row) => [...row])
  copy[r][c] = rotateCW(copy[r][c])
  return copy
}

test('a click turns one tile clockwise', () => {
  const state = newGameFromBoards(TREE, withTurned(TREE, 0, 0))
  const next = rotate(state, 1, 2)

  expect(next.masks[1][2]).toBe(W)
  expect(next.masks[0][0]).toBe(S)
  expect(state.masks[1][2]).toBe(S) // the old state is left alone
})

test('turning the last tile into place solves the board, and a solved board ignores clicks', () => {
  const almost = newGameFromBoards(TREE, withTurned(withTurned(withTurned(TREE, 0, 0), 0, 0), 0, 0))
  const solved = rotate(almost, 0, 0)

  expect(almost.solved).toBe(false)
  expect(solved.solved).toBe(true)
  expect(rotate(solved, 1, 1)).toBe(solved)
})

test('a straight counts as placed in either of its two rotations', () => {
  const straightTree: number[][] = [
    [E, E | W, W | S],
    [E, W | S, N | S],
    [E, N | W | E, W | N],
  ]
  const state = newGameFromBoards(straightTree, withTurned(straightTree, 0, 1))
  const turnedTwice = rotate(rotate(rotate(state, 0, 1), 0, 1), 0, 1)

  expect(turnedTwice.masks[0][1]).toBe(E | W)
  expect(turnedTwice.solved).toBe(true)
})

test('the source sits in the centre, or up and left of it on an even board', () => {
  expect(newGame(5, seeded(1)).source).toEqual({ r: 2, c: 2 })
  expect(newGame(4, seeded(1)).source).toEqual({ r: 1, c: 1 })
})

test('a generated answer is one tree over every tile, with no crosses', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const tree = generateTree(7, seeded(seed))

    expect(isSolved(tree, { r: 3, c: 3 })).toBe(true)
    expect(tree.flat().every((mask) => armCount(mask) >= 1 && armCount(mask) <= 3)).toBe(true)
  }
})

test('a scramble keeps every tile’s kind and is never already solved', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const dealt = scramble(TREE, seeded(seed))

    expect(isSolved(dealt, CENTRE)).toBe(false)
    dealt.forEach((row, r) => row.forEach((mask, c) => expect(kindOf(mask)).toBe(kindOf(TREE[r][c]))))
  }
})

test('the same seed deals the same game', () => {
  expect(newGame(7, seeded(42))).toEqual(newGame(7, seeded(42)))
  expect(newGame(7, seeded(42)).masks).not.toEqual(newGame(7, seeded(43)).masks)
})

test('a locked tile does not turn', () => {
  const state = toggleLock(newGameFromBoards(TREE, withTurned(TREE, 0, 0)), 0, 0)

  expect(state.locked[0][0]).toBe(true)
  expect(rotate(state, 0, 0)).toBe(state)
  expect(toggleLock(state, 0, 0).locked[0][0]).toBe(false)
})

test('locks have no say in whether the board is solved', () => {
  const almost = toggleLock(newGameFromBoards(TREE, withTurned(withTurned(withTurned(TREE, 0, 0), 0, 0), 0, 0)), 1, 2)

  expect(rotate(almost, 0, 0).solved).toBe(true)
})

test('undo steps back one action at a time, turns and locks alike', () => {
  const dealt = newGameFromBoards(TREE, withTurned(TREE, 0, 0))
  const turned = rotate(dealt, 1, 2)
  const locked = toggleLock(turned, 2, 2)

  expect(dealt.past).toHaveLength(0)
  expect(locked.past).toHaveLength(2)
  expect(undo(locked).locked).toEqual(dealt.locked)
  expect(undo(locked).masks).toEqual(turned.masks)
  expect(undo(undo(locked)).masks).toEqual(dealt.masks)
  expect(undo(dealt)).toBe(dealt)
})

test('a solved board takes no locks', () => {
  const solved = rotate(newGameFromBoards(TREE, withTurned(withTurned(withTurned(TREE, 0, 0), 0, 0), 0, 0)), 0, 0)

  expect(toggleLock(solved, 1, 1)).toBe(solved)
})
