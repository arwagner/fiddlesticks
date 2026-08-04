import { test, expect } from 'vitest'
import {
  generateSolution,
  lineClue,
  rowClues,
  colClues,
  newGame,
  newGameFromSolution,
  applyMark,
  type GameState,
} from './nonogram-logic'

// A symmetric "X" solution (T = filled) used as a deterministic fixture.
const T = true
const F = false
const X_GRID: boolean[][] = [
  [T, F, F, F, T],
  [F, T, F, T, F],
  [F, F, T, F, F],
  [F, T, F, T, F],
  [T, F, F, F, T],
]

function fillAllTrue(state: GameState): GameState {
  let s = state
  for (let r = 0; r < s.size; r += 1) {
    for (let c = 0; c < s.size; c += 1) {
      if (s.solution[r][c]) s = applyMark(s, r, c, 'fill')
    }
  }
  return s
}

test('feat-004/AC-1: generateSolution shape; newGame starts blank with 0 mistakes', () => {
  const sol = generateSolution(5)
  expect(sol.length).toBe(5)
  expect(sol.every((row) => row.length === 5 && row.every((v) => typeof v === 'boolean'))).toBe(true)

  const g = newGame(5)
  expect(g.size).toBe(5)
  expect(g.mistakes).toBe(0)
  expect(g.board.flat().every((cell) => cell === 'blank')).toBe(true)
  expect(g.rowClues.length).toBe(5)
  expect(g.colClues.length).toBe(5)
})

test('feat-004/AC-2: clue derivation lists run lengths in order; empty line is [0]', () => {
  expect(lineClue([F, F, F, F, F])).toEqual([0])
  expect(lineClue([T, T, F, T, F])).toEqual([2, 1])
  expect(lineClue([T, F, T, F, T])).toEqual([1, 1, 1])
  expect(lineClue([T, T, T, T, T])).toEqual([5])
  // on the X fixture, both axes are [1,1]/[1]/[1,1]/... symmetric
  expect(rowClues(X_GRID)).toEqual([[1, 1], [1, 1], [1], [1, 1], [1, 1]])
  expect(colClues(X_GRID)).toEqual([[1, 1], [1, 1], [1], [1, 1], [1, 1]])
})

test('feat-004/AC-3: correct fill commits; wrong fill counts and reveals the correct value (red X)', () => {
  let s = newGameFromSolution(X_GRID)
  s = applyMark(s, 0, 0, 'fill') // solution filled → correct
  expect(s.board[0][0]).toBe('filled')
  expect(s.mistakes).toBe(0)

  s = applyMark(s, 0, 1, 'fill') // solution empty → wrong; correct value is X, flagged red
  expect(s.board[0][1]).toBe('wrong-x')
  expect(s.mistakes).toBe(1)
})

test('feat-004/AC-4: correct X commits; wrong X counts and reveals the correct value (red fill)', () => {
  let s = newGameFromSolution(X_GRID)
  s = applyMark(s, 0, 1, 'x') // solution empty → correct X
  expect(s.board[0][1]).toBe('x')
  expect(s.mistakes).toBe(0)

  s = applyMark(s, 0, 0, 'x') // solution filled → wrong; correct value is filled, flagged red
  expect(s.board[0][0]).toBe('wrong-filled')
  expect(s.mistakes).toBe(1)
})

test('feat-004/AC-1 + AC-2: every generated row and column has a filled cell (no "0" clue)', () => {
  for (let i = 0; i < 300; i += 1) {
    const g = newGame(5)
    expect(g.rowClues.every((clue) => clue[0] !== 0)).toBe(true)
    expect(g.colClues.every((clue) => clue[0] !== 0)).toBe(true)
  }
})

test('feat-004/AC-5: completing a line auto-marks its remaining cells X (row and column)', () => {
  let s = newGameFromSolution(X_GRID)
  s = applyMark(s, 2, 2, 'fill') // row 2 and col 2 each have their single filled cell now placed
  // row 2 remaining blanks → X
  expect(s.board[2]).toEqual(['x', 'x', 'filled', 'x', 'x'])
  // col 2 remaining blanks → X
  expect([s.board[0][2], s.board[1][2], s.board[3][2], s.board[4][2]]).toEqual(['x', 'x', 'x', 'x'])
})

test('feat-004/AC-6: mistakes accumulate across wrong marks', () => {
  let s = newGameFromSolution(X_GRID)
  s = applyMark(s, 0, 1, 'fill') // wrong
  s = applyMark(s, 1, 0, 'fill') // wrong
  s = applyMark(s, 2, 0, 'x') // solution empty → correct, no mistake
  expect(s.mistakes).toBe(2)
})

test('feat-004/AC-7: won exactly when every solution-filled cell is filled', () => {
  const s = fillAllTrue(newGameFromSolution(X_GRID))
  expect(s.won).toBe(true)
  // and not before: a fresh game with filled cells is not won
  expect(newGameFromSolution(X_GRID).won).toBe(false)
})

test('feat-004/AC-8: a new game resets board and mistakes', () => {
  let s = newGameFromSolution(X_GRID)
  s = applyMark(s, 0, 1, 'fill') // rack up a mistake
  expect(s.mistakes).toBe(1)
  const fresh = newGameFromSolution(X_GRID) // "New puzzle"
  expect(fresh.mistakes).toBe(0)
  expect(fresh.board.flat().every((cell) => cell === 'blank')).toBe(true)
})
