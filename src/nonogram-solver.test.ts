import { describe, expect, test } from 'vitest'
import { deduceLine, isLineSolvable, lineArrangements, solveByLines } from './nonogram-solver'
import { colClues, generateSolvableSolution, rowClues } from './nonogram-logic'

const b = (pattern: string): boolean[] => [...pattern].map((char) => char === '#')

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

describe('generateSolvableSolution', () => {
  test.each([2, 5, 8, 10])('a size %i puzzle needs no guessing', (size) => {
    for (let i = 0; i < 25; i += 1) {
      const solution = generateSolvableSolution(size)

      expect(isLineSolvable(rowClues(solution), colClues(solution))).toBe(true)
    }
  })
})
