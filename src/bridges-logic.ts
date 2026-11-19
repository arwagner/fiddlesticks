// The rules of Bridges (no DOM). Islands sit on a square grid of water. Two islands in a line with only
// water between them are neighbours, and each pair of neighbours has a level: how many bridges join them,
// 0, 1 or 2. The board state is just one level per pair.

import { solve } from './bridges-solver'

export type Island = { row: number; col: number; count: number }

export type Orientation = 'across' | 'down'

// Two neighbouring islands, by index into the island list. `a` is the one to the left or above.
export type NeighbourPair = { a: number; b: number; orientation: Orientation }

export type Puzzle = {
  size: number
  islands: Island[]
  pairs: NeighbourPair[]
  // For each pair, the pairs whose bridges would cross its bridge.
  crossings: number[][]
}

export const MAX_LEVEL = 2

// Each island's nearest island to the right and below is its neighbour. Looking only that way finds every
// pair once.
export function findPairs(size: number, islands: Island[]): NeighbourPair[] {
  const at = new Map(islands.map((island, index) => [island.row * size + island.col, index]))
  const pairs: NeighbourPair[] = []

  islands.forEach((island, a) => {
    for (let col = island.col + 1; col < size; col += 1) {
      const b = at.get(island.row * size + col)

      if (b !== undefined) {
        pairs.push({ a, b, orientation: 'across' })
        break
      }
    }

    for (let row = island.row + 1; row < size; row += 1) {
      const b = at.get(row * size + island.col)

      if (b !== undefined) {
        pairs.push({ a, b, orientation: 'down' })
        break
      }
    }
  })

  return pairs
}

// A bridge across and a bridge down cross when each passes strictly between the other's ends. Bridges
// that only share an island don't cross.
export function findCrossings(islands: Island[], pairs: NeighbourPair[]): number[][] {
  const crossings = pairs.map((): number[] => [])

  pairs.forEach((across, i) => {
    if (across.orientation !== 'across') {
      return
    }

    const row = islands[across.a].row
    const left = islands[across.a].col
    const right = islands[across.b].col

    pairs.forEach((down, j) => {
      if (down.orientation !== 'down') {
        return
      }

      const col = islands[down.a].col
      const top = islands[down.a].row
      const bottom = islands[down.b].row

      if (left < col && col < right && top < row && row < bottom) {
        crossings[i].push(j)
        crossings[j].push(i)
      }
    })
  })

  return crossings
}

export function makePuzzle(size: number, islands: Island[]): Puzzle {
  const pairs = findPairs(size, islands)

  return { size, islands, pairs, crossings: findCrossings(islands, pairs) }
}

// How many bridges touch each island.
export function bridgeCounts(puzzle: Puzzle, levels: number[]): number[] {
  const counts = puzzle.islands.map(() => 0)

  puzzle.pairs.forEach((pair, p) => {
    counts[pair.a] += levels[p]
    counts[pair.b] += levels[p]
  })

  return counts
}

export type IslandStatus = 'open' | 'done' | 'over'

export function islandStatuses(puzzle: Puzzle, levels: number[]): IslandStatus[] {
  return bridgeCounts(puzzle, levels).map((bridges, i) => {
    const count = puzzle.islands[i].count
    return bridges === count ? 'done' : bridges > count ? 'over' : 'open'
  })
}

// A label for each island, shared by every island that bridges connect it to.
export function connectedGroups(puzzle: Puzzle, levels: number[]): number[] {
  const group = puzzle.islands.map((_, i) => i)
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])))

  puzzle.pairs.forEach((pair, p) => {
    if (levels[p] > 0) {
      group[find(pair.a)] = find(pair.b)
    }
  })

  return group.map((_, i) => find(i))
}

export function isConnected(puzzle: Puzzle, levels: number[]): boolean {
  return new Set(connectedGroups(puzzle, levels)).size <= 1
}

// The pairs with bridges that block a bridge on pair p.
export function blockers(puzzle: Puzzle, levels: number[], p: number): number[] {
  return puzzle.crossings[p].filter((q) => levels[q] > 0)
}

// Checked against the rules, not against the stored solution.
export function isSolved(puzzle: Puzzle, levels: number[]): boolean {
  return (
    islandStatuses(puzzle, levels).every((status) => status === 'done') &&
    isConnected(puzzle, levels) &&
    levels.every((level, p) => level === 0 || blockers(puzzle, levels, p).length === 0)
  )
}

export function isDeducible(puzzle: Puzzle): boolean {
  return solve(puzzle).status === 'solved'
}

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: 0 },
] as const

// About a fifth of the cells hold an island, the genre's usual density.
export function targetIslands(size: number): number {
  return Math.round(size * size * 0.2)
}

// After this many refused steps in a row no more islands fit, and the board is kept with fewer.
const MAX_REFUSED_STEPS = 1000

// A dealt board and its solution: the level of each pair.
export type Board = { puzzle: Puzzle; solution: number[] }

// A board grown one island at a time, each joined to one already there by 1 or 2 bridges, so the bridges
// laid down are a solution. Returns the islands with their counts and that solution's level for each pair.
export function growBoard(size: number, random: () => number): Board {
  const pick = (n: number) => Math.floor(random() * n)
  const cells = size * size
  // An island's index in each cell, and whether a bridge runs over each cell.
  const islandIn = new Array<number>(cells).fill(-1)
  const bridged = new Array<boolean>(cells).fill(false)
  const islands: Island[] = []
  const laid: { a: number; b: number; level: number }[] = []
  const inside = (row: number, col: number) => row >= 0 && row < size && col >= 0 && col < size
  const isIsland = (row: number, col: number) => inside(row, col) && islandIn[row * size + col] >= 0

  const place = (row: number, col: number) => {
    islandIn[row * size + col] = islands.length
    islands.push({ row, col, count: 0 })
  }

  place(pick(size), pick(size))

  for (let refused = 0; islands.length < targetIslands(size) && refused < MAX_REFUSED_STEPS;) {
    const from = pick(islands.length)
    const { dr, dc } = DIRECTIONS[pick(4)]
    const distance = 2 + pick(Math.min(size - 2, 4))
    // The cell this many steps from the island it grows from.
    const cellAt = (step: number) => (islands[from].row + dr * step) * size + islands[from].col + dc * step
    const row = islands[from].row + dr * distance
    const col = islands[from].col + dc * distance
    let clear = inside(row, col)

    for (let step = 1; clear && step <= distance; step += 1) {
      clear = islandIn[cellAt(step)] < 0 && !bridged[cellAt(step)]
    }

    // A new island beside another would make a bridge too short to see.
    clear &&= DIRECTIONS.every((d) => !isIsland(row + d.dr, col + d.dc))

    if (!clear) {
      refused += 1
      continue
    }

    refused = 0

    for (let step = 1; step < distance; step += 1) {
      bridged[cellAt(step)] = true
    }

    const level = 1 + pick(MAX_LEVEL)
    place(row, col)
    islands[from].count += level
    islands[islands.length - 1].count += level
    laid.push({ a: from, b: islands.length - 1, level })
  }

  const puzzle = makePuzzle(size, islands)
  const solution = puzzle.pairs.map(() => 0)
  laid.forEach(({ a, b, level }) => {
    solution[pairBetween(puzzle, a, b)] = level
  })

  return { puzzle, solution }
}

// A board the player can finish by deduction alone, which also makes its solution the only one. If every
// attempt fails this returns the last board, which may need a guess.
export function generateSolvableBoard(size: number, random: () => number, maxAttempts = 100): Board {
  let board = growBoard(size, random)

  for (let attempt = 1; attempt < maxAttempts && !isDeducible(board.puzzle); attempt += 1) {
    board = growBoard(size, random)
  }

  return board
}

export type GameState = {
  puzzle: Puzzle
  solution: number[]
  levels: number[]
  // Each earlier set of levels, newest last, so undo just pops one.
  past: number[][]
  solved: boolean
}

export function newGameFromBoard(puzzle: Puzzle, solution: number[], levels = puzzle.pairs.map(() => 0)): GameState {
  return { puzzle, solution: [...solution], levels: [...levels], past: [], solved: isSolved(puzzle, levels) }
}

export function newGame(size: number, random: () => number = Math.random): GameState {
  const { puzzle, solution } = generateSolvableBoard(size, random)

  return newGameFromBoard(puzzle, solution)
}

// One more bridge on the pair, or none after two. Each move returns the same state when it changes nothing,
// so the view can skip a redraw. A solved board takes no more moves until a new deal.
export function cycle(state: GameState, p: number): GameState {
  const level = (state.levels[p] + 1) % (MAX_LEVEL + 1)

  if (state.solved || (level > 0 && blockers(state.puzzle, state.levels, p).length > 0)) {
    return state
  }

  return setLevel(state, p, level)
}

function setLevel(state: GameState, p: number, level: number): GameState {
  const levels = [...state.levels]
  levels[p] = level

  return { ...state, levels, past: [...state.past, state.levels], solved: isSolved(state.puzzle, levels) }
}

export function undo(state: GameState): GameState {
  const previous = state.past[state.past.length - 1]

  if (state.solved || !previous) {
    return state
  }

  return { ...state, levels: previous, past: state.past.slice(0, -1) }
}

// A pair with more bridges than the solution, or one the player could settle now.
export type Hint = { type: 'wrong'; pair: number } | { type: 'fix'; pair: number; level: number }

// Too many bridges on a pair come first: the solver would work from them and go wrong. A pair with fewer
// bridges than the solution is short, not wrong, so the current levels go to the solver as the least each
// pair has. The hints are the pairs it settles on its earliest pass, at a level they don't have yet.
export function findHints(state: GameState): Hint[] {
  if (state.solved) {
    return []
  }

  const wrong = state.levels.flatMap((level, pair) => (level > state.solution[pair] ? [pair] : []))

  if (wrong.length > 0) {
    return wrong.map((pair) => ({ type: 'wrong' as const, pair }))
  }

  const { lower, upper, settledOnPass } = solve(state.puzzle, state.levels)
  const changes = lower.flatMap((level, pair) => (level === upper[pair] && level !== state.levels[pair] ? [pair] : []))
  const earliest = Math.min(...changes.map((pair) => settledOnPass[pair]))

  return changes
    .filter((pair) => settledOnPass[pair] === earliest)
    .map((pair) => ({ type: 'fix' as const, pair, level: lower[pair] }))
}

// A fix sets the pair's level as one undoable step. A wrong pair is only pointed out.
export function applyHint(state: GameState, hint: Hint): GameState {
  if (state.solved || hint.type !== 'fix' || state.levels[hint.pair] === hint.level) {
    return state
  }

  return setLevel(state, hint.pair, hint.level)
}

// The pair joining two islands, or -1 when they aren't neighbours.
export function pairBetween(puzzle: Puzzle, from: number, to: number): number {
  return puzzle.pairs.findIndex(({ a, b }) => (a === from && b === to) || (a === to && b === from))
}
