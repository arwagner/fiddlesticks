// Pure, size-parameterized nonogram rules for feat-004 (no DOM) — unit-testable. nonogram.ts renders it.

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

export function newGame(size: number): GameState {
  return newGameFromSolution(generateSolution(size))
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => [...row])
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
