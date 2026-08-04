// A line solver for nonogram clues (no DOM). nonogram-logic.ts uses it to reject puzzles that need guessing.
//
// The solver knows one trick: for a single line, list every arrangement that fits the clue and the cells
// already known. Cells that hold the same value in every arrangement are certain. Repeat over all rows and
// columns until nothing changes. A puzzle the solver finishes is solvable by line logic alone, which also
// makes its solution unique.

// null = still unknown. true = filled. false = empty.
export type Known = boolean | null

// Every way to place a clue's runs in a line of the given length.
export function lineArrangements(clue: number[], length: number): boolean[][] {
  const runs = clue.filter((run) => run > 0)
  const results: boolean[][] = []
  const line: boolean[] = Array.from({ length }, () => false)

  // Space needed by the runs after this one, each with its one-cell gap.
  const tailSpace = runs.map((_, i) => runs.slice(i + 1).reduce((total, run) => total + run + 1, 0))

  function place(runIndex: number, from: number): void {
    if (runIndex === runs.length) {
      results.push([...line])
      return
    }

    const run = runs[runIndex]
    const lastStart = length - tailSpace[runIndex] - run

    for (let start = from; start <= lastStart; start += 1) {
      line.fill(true, start, start + run)
      place(runIndex + 1, start + run + 1)
      line.fill(false, start, start + run)
    }
  }

  place(0, 0)

  return results
}

// The fixpoint loop asks for the same line many times, so keep the arrangements.
const arrangementCache = new Map<string, boolean[][]>()

function cachedArrangements(clue: number[], length: number): boolean[][] {
  const key = `${length}:${clue.join(',')}`
  const hit = arrangementCache.get(key)

  if (hit) {
    return hit
  }

  const arrangements = lineArrangements(clue, length)
  arrangementCache.set(key, arrangements)

  return arrangements
}

// What one line's clue proves, given what is already known. Returns null if the clue and the known cells
// contradict each other.
export function deduceLine(clue: number[], known: Known[]): Known[] | null {
  const fits = cachedArrangements(clue, known.length).filter((arrangement) =>
    arrangement.every((value, i) => known[i] === null || known[i] === value),
  )

  if (fits.length === 0) {
    return null
  }

  return known.map((value, i) => {
    if (value !== null) {
      return value
    }

    const first = fits[0][i]

    return fits.every((fit) => fit[i] === first) ? first : null
  })
}

export type SolveResult = {
  grid: Known[][] // what line logic proves, with null for cells it cannot decide
  solved: boolean // true when the grid holds no null
}

// Apply line logic to every row and column until a pass proves nothing new.
export function solveByLines(rowClues: number[][], colClues: number[][]): SolveResult {
  const size = rowClues.length
  const grid: Known[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => null as Known))

  let changed = true

  while (changed) {
    changed = false

    for (let r = 0; r < size; r += 1) {
      const next = deduceLine(rowClues[r], grid[r])

      if (!next) {
        return { grid, solved: false }
      }

      for (let c = 0; c < size; c += 1) {
        if (next[c] !== grid[r][c]) {
          grid[r][c] = next[c]
          changed = true
        }
      }
    }

    for (let c = 0; c < size; c += 1) {
      const column = grid.map((row) => row[c])
      const next = deduceLine(colClues[c], column)

      if (!next) {
        return { grid, solved: false }
      }

      for (let r = 0; r < size; r += 1) {
        if (next[r] !== grid[r][c]) {
          grid[r][c] = next[r]
          changed = true
        }
      }
    }
  }

  return { grid, solved: grid.every((row) => row.every((cell) => cell !== null)) }
}

// True when the clues lead to the answer by line logic alone, so the player never has to guess.
export function isLineSolvable(rowClues: number[][], colClues: number[][]): boolean {
  return solveByLines(rowClues, colClues).solved
}
