import { describe, expect, test } from 'vitest'
import { deduceLine, isLineSolvable, lineArrangements, solveByLines, type Known } from './nonogram-solver'
import {
  applyMark,
  colClues,
  findHints,
  generateSolvableSolution,
  newGame,
  rowClues,
  type Cell,
} from './nonogram-logic'

const b = (pattern: string): boolean[] => [...pattern].map((char) => char === '#')

const toKnown = (cell: Cell): Known =>
  cell === 'blank' ? null : cell === 'filled' || cell === 'wrong-filled'

describe('lineArrangements', () => {
  test('a run that fills the line has one placement', () => {
    expect(lineArrangements([3], 3)).toEqual([b('###')])
  })

  test('a short run slides along the line', () => {
    expect(lineArrangements([1], 3)).toEqual([b('#..'), b('.#.'), b('..#')])
  })

  test('two runs keep a gap between them', () => {
    expect(lineArrangements([1, 1], 4)).toEqual([b('#.#.'), b('#..#'), b('.#.#')])
  })

  test('an empty clue leaves the line blank', () => {
    expect(lineArrangements([0], 3)).toEqual([b('...')])
  })
})

describe('deduceLine', () => {
  const unknown = (n: number) => Array.from({ length: n }, () => null)

  test('a run wider than half the line proves its overlap', () => {
    expect(deduceLine([3], unknown(4))).toEqual([null, true, true, null])
  })

  test('a filled cell can pin the whole line', () => {
    expect(deduceLine([2], [true, null, null])).toEqual([true, true, false])
  })

  test('a clue that fits many ways proves nothing', () => {
    expect(deduceLine([1], unknown(3))).toEqual([null, null, null])
  })

  test('a clue that contradicts the known cells returns null', () => {
    expect(deduceLine([3], [false, null, null])).toBeNull()
  })
})

describe('solveByLines', () => {
  test('it solves a grid that line logic can finish', () => {
    const solution = [b('#.#'), b('.#.'), b('#.#')]

    const result = solveByLines(rowClues(solution), colClues(solution))

    expect(result.solved).toBe(true)
    expect(result.grid).toEqual(solution)
  })

  test('it stops short on a switching pair, which has two solutions', () => {
    // Swapping the diagonals gives the same row and column clues, so no logic can choose between them.
    const solution = [b('#.'), b('.#')]

    const result = solveByLines(rowClues(solution), colClues(solution))

    expect(result.solved).toBe(false)
    expect(result.grid).toEqual([
      [null, null],
      [null, null],
    ])
  })

  test('it proves the cells it can, even when the grid stays unfinished', () => {
    const solution = [b('##.'), b('#.#'), b('.##')]

    const result = solveByLines(rowClues(solution), colClues(solution))

    expect(result.grid[1]).toEqual([true, false, true])
  })
})

describe('findHints', () => {
  test('every hint names a blank cell that its own line decides', () => {
    let state = newGame(8)

    // Play a few correct marks, so the hints must account for the board and not just the clues.
    state = applyMark(state, 0, 0, state.solution[0][0] ? 'fill' : 'x')
    state = applyMark(state, 3, 4, state.solution[3][4] ? 'fill' : 'x')

    const hints = findHints(state)

    expect(hints.length).toBeGreaterThan(0)

    for (const hint of hints) {
      expect(state.board[hint.r][hint.c]).toBe('blank')

      const known: Known[] =
        hint.line === 'row'
          ? state.board[hint.r].map(toKnown)
          : state.board.map((row) => toKnown(row[hint.c]))
      const clue = hint.line === 'row' ? state.rowClues[hint.r] : state.colClues[hint.index]
      const at = hint.line === 'row' ? hint.c : hint.r

      expect(deduceLine(clue, known)![at]).toBe(state.solution[hint.r][hint.c])
    }
  })

  test('a hint stays available at every step until the puzzle is solved', () => {
    let state = newGame(8)

    // Follow the hints alone. If they ever run dry early, this loop cannot finish the board.
    for (let step = 0; !state.won; step += 1) {
      expect(step).toBeLessThan(state.size * state.size) // no infinite loop

      const hints = findHints(state)

      expect(hints.length).toBeGreaterThan(0)

      const { r, c } = hints[0]
      state = applyMark(state, r, c, state.solution[r][c] ? 'fill' : 'x')
    }

    expect(state.mistakes).toBe(0)
    expect(findHints(state)).toEqual([])
  })
})

describe('generateSolvableSolution', () => {
  test.each([2, 5, 8, 10])('a size %i puzzle needs no guessing', (size) => {
    for (let i = 0; i < 25; i += 1) {
      const solution = generateSolvableSolution(size)

      expect(isLineSolvable(rowClues(solution), colClues(solution))).toBe(true)
    }
  })
})
