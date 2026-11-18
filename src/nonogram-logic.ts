// Pure, size-parameterized nonogram rules for feat-004 (no DOM) — unit-testable. nonogram.ts renders it.

import { deduceLine, isLineSolvable, type Known } from './nonogram-solver'

// 'wrong-filled' / 'wrong-x' hold the CORRECT value for a cell the player marked wrong — rendered red.
export type Cell = 'blank' | 'filled' | 'x' | 'wrong-filled' | 'wrong-x'

export type GameState = {
  size: number
  solution: boolean[][] // true = a filled cell in the answer
  board: Cell[][]
  rowClues: number[][]
  colClues: number[][]
  mistakes: number
  won: boolean
}

// feat-004/AC-1: a random size×size solution (~55% filled), repaired so every row AND every column has
// at least one filled cell — so no line clue is "0".
export function generateSolution(size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => Math.random() < 0.55))

  for (let r = 0; r < size; r += 1) {
    if (grid[r].every((filled) => !filled)) {
      grid[r][Math.floor(Math.random() * size)] = true
    }
  }
  for (let c = 0; c < size; c += 1) {
    if (grid.every((row) => !row[c])) {
      grid[Math.floor(Math.random() * size)][c] = true
    }
  }

  return grid
}

// feat-004/AC-2: run lengths of consecutive filled cells in a line, in order; [0] for an empty line.
export function lineClue(line: boolean[]): number[] {
  const clue: number[] = []
  let run = 0

  for (const filled of line) {
    if (filled) {
      run += 1
    } else if (run > 0) {
      clue.push(run)
      run = 0
    }
  }
  if (run > 0) {
    clue.push(run)
  }

  return clue.length > 0 ? clue : [0]
}

export function rowClues(solution: boolean[][]): number[][] {
  return solution.map((row) => lineClue(row))
}

export function colClues(solution: boolean[][]): number[][] {
  const size = solution.length
  return Array.from({ length: size }, (_, c) => lineClue(solution.map((row) => row[c])))
}

// A cell shows a filled value whether it was placed correctly or revealed red after a wrong X.
function isFilledValue(cell: Cell): boolean {
  return cell === 'filled' || cell === 'wrong-filled'
}

// feat-004/AC-7: won when every solution-filled cell shows a filled value on the board.
function boardIsWon(solution: boolean[][], board: Cell[][]): boolean {
  for (let r = 0; r < solution.length; r += 1) {
    for (let c = 0; c < solution.length; c += 1) {
      if (solution[r][c] && !isFilledValue(board[r][c])) {
        return false
      }
    }
  }
  return true
}

export function isWon(state: GameState): boolean {
  return boardIsWon(state.solution, state.board)
}

export function newGameFromSolution(solution: boolean[][]): GameState {
  const size = solution.length
  const board: Cell[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 'blank' as Cell))

  return {
    size,
    solution,
    board,
    rowClues: rowClues(solution),
    colClues: colClues(solution),
    mistakes: 0,
    won: boardIsWon(solution, board), // an all-empty solution is vacuously won from the start
  }
}

// A puzzle the player can finish by line logic alone, so no step needs a guess. Random grids fail this
// often enough to matter: about 1 in 4 at size 8. Generate and test is cheap here, because a test costs
// well under a millisecond and most grids pass on the first or second try.
//
// If every attempt fails, this returns the last grid. That puzzle may need a guess. The cap is high enough
// that the case is not reachable in practice at the sizes this game uses.
export function generateSolvableSolution(size: number, maxAttempts = 200): boolean[][] {
  let solution = generateSolution(size)

  for (let attempt = 1; attempt < maxAttempts; attempt += 1) {
    if (isLineSolvable(rowClues(solution), colClues(solution))) {
      return solution
    }

    solution = generateSolution(size)
  }

  return solution
}

export function newGame(size: number): GameState {
  return newGameFromSolution(generateSolvableSolution(size))
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row])
}

// A cell the player can work out right now, and the line that proves it.
export type Hint = {
  r: number
  c: number
  line: 'row' | 'column'
  index: number // the row or column number, counted from 0
}

// What the player knows, read off the board. Every decided cell is correct, because a wrong mark reveals
// the true value.
function knownFromBoard(board: Cell[][]): Known[][] {
  return board.map((row) => row.map((cell) => (cell === 'blank' ? null : isFilledValue(cell))))
}

// Every blank cell that ONE line's clue decides, given the marks already on the board. A hint from a single
// line is a hint the player can check by eye. The solver's full fixpoint would also find cells that need
// several rounds of reasoning, which does not teach anything.
//
// While the board is unfinished this never comes back empty. newGame only deals puzzles that line logic can
// finish from an empty board, and the player's marks only add correct information, so some line always has
// more to give.
export function findHints(state: GameState): Hint[] {
  if (state.won) {
    return []
  }

  const known = knownFromBoard(state.board)
  const hints: Hint[] = []

  for (let r = 0; r < state.size; r += 1) {
    const next = deduceLine(state.rowClues[r], known[r])

    for (let c = 0; next && c < state.size; c += 1) {
      if (known[r][c] === null && next[c] !== null) {
        hints.push({ r, c, line: 'row', index: r })
      }
    }
  }

  for (let c = 0; c < state.size; c += 1) {
    const next = deduceLine(
      state.colClues[c],
      known.map((row) => row[c]),
    )

    for (let r = 0; next && r < state.size; r += 1) {
      if (known[r][c] === null && next[r] !== null) {
        hints.push({ r, c, line: 'column', index: c })
      }
    }
  }

  return hints
}

// feat-004/AC-5: if every solution-filled cell in a line is now filled, mark its remaining blanks X.
function autoXLine(solution: boolean[][], board: Cell[][], cells: Array<[number, number]>): void {
  const allFilledPlaced = cells.every(([r, c]) => !solution[r][c] || isFilledValue(board[r][c]))

  if (!allFilledPlaced) {
    return
  }

  for (const [r, c] of cells) {
    if (board[r][c] === 'blank') {
      board[r][c] = 'x'
    }
  }
}

// feat-004/AC-3, AC-4, AC-5, AC-6, AC-7: apply a mark, validated against the solution. A wrong mark is
// counted and the cell revealed with its correct value (flagged red); a correct mark commits. Either way,
// auto-X any completed line and re-check win. Marks on an already-decided cell (or after the win) are ignored.
export function applyMark(state: GameState, r: number, c: number, intent: 'fill' | 'x'): GameState {
  if (state.won || state.board[r][c] !== 'blank') {
    return state
  }

  const correct = intent === 'fill' ? state.solution[r][c] : !state.solution[r][c]

  const board = cloneBoard(state.board)
  let mistakes = state.mistakes

  if (correct) {
    board[r][c] = intent === 'fill' ? 'filled' : 'x'
  } else {
    // feat-004/AC-3, AC-4: a wrong mark counts, and the cell is set to its CORRECT value, flagged red.
    mistakes += 1
    board[r][c] = state.solution[r][c] ? 'wrong-filled' : 'wrong-x'
  }

  const row: Array<[number, number]> = Array.from({ length: state.size }, (_, cc) => [r, cc])
  const col: Array<[number, number]> = Array.from({ length: state.size }, (_, rr) => [rr, c])
  autoXLine(state.solution, board, row)
  autoXLine(state.solution, board, col)

  return { ...state, board, mistakes, won: boardIsWon(state.solution, board) }
}

// A drag marks a straight run of cells. It follows the row or the column of the cell it started on, so a
// shaky hand does not stray into the next line.
export type DragAxis = 'row' | 'column'

export type CellPos = { r: number; c: number }

// The line a drag follows, picked by the first move off its starting cell: mostly sideways follows the row,
// mostly up or down follows the column. A tie goes to the row. Null while the pointer is still on the start.
export function dragAxis(start: CellPos, to: CellPos): DragAxis | null {
  const dr = Math.abs(to.r - start.r)
  const dc = Math.abs(to.c - start.c)

  if (dr === 0 && dc === 0) {
    return null
  }

  return dc >= dr ? 'row' : 'column'
}

// Every cell from the start to the pointer, along the drag's line, start included. A pointer off the line
// counts as the cell on the line level with it.
export function dragCells(start: CellPos, to: CellPos, axis: DragAxis): CellPos[] {
  const from = axis === 'row' ? start.c : start.r
  const end = axis === 'row' ? to.c : to.r
  const step = end >= from ? 1 : -1
  const cells: CellPos[] = []

  for (let i = from; i !== end + step; i += step) {
    cells.push(axis === 'row' ? { r: start.r, c: i } : { r: i, c: start.c })
  }

  return cells
}

// Mark each cell in turn with the same intent, exactly as one click per cell would. Decided cells are
// skipped, and once the puzzle is won the rest are ignored. Returns the same state when nothing changed.
export function applyMarks(state: GameState, cells: CellPos[], intent: 'fill' | 'x'): GameState {
  return cells.reduce((next, { r, c }) => applyMark(next, r, c, intent), state)
}
