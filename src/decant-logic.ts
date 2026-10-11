// Pure, size-parameterized Decant rules (no DOM) — decant.ts renders them, decant-solver.ts searches them.

import { solve } from './decant-solver'

// A bottle is a stack of color indices, bottom layer first. The last entry is the top layer, and the top
// layer is the only one a pour can take.
export type Bottle = number[]

export type Move = { from: number; to: number }

export type DealOptions = {
  colors: number // one full bottle per color
  capacity: number // layers of sand a bottle holds
  empties: number // spare bottles dealt empty, the room the player has to work in
}

export type GameOptions = DealOptions & {
  minMoves: number // reject a deal the solver finishes in fewer pours than this
}

// One spare bottle and five layers make a board that takes real planning; six colors keeps the shelf
// readable and the search quick.
export const DEFAULT_DEAL: DealOptions = { colors: 6, capacity: 5, empties: 1 }

// Measured over random deals: the shortest solution runs to a little under one pour per layer of sand
// that is not already home — colors x (capacity - 1). Asking for four fifths of that throws out the
// pushovers and still leaves most deals to choose from.
export function defaultMinMoves(colors: number, capacity: number): number {
  return Math.round(0.8 * colors * (capacity - 1))
}

export type GameState = {
  capacity: number
  bottles: Bottle[]
  past: Bottle[][] // every earlier arrangement, oldest first — undo pops the last
  moves: number
  won: boolean
  par: number | null // shortest solution of the deal, null when the solver gave up on it
}

// The unbroken run of one color at the top of a bottle: the sand a pour would take.
export function topRun(bottle: Bottle): { color: number; count: number } | null {
  if (bottle.length === 0) {
    return null
  }

  const color = bottle[bottle.length - 1]
  let count = 1

  while (count < bottle.length && bottle[bottle.length - 1 - count] === color) {
    count += 1
  }

  return { color, count }
}

export function freeSpace(bottle: Bottle, capacity: number): number {
  return capacity - bottle.length
}

// How many layers a pour moves: the whole run at the top, or as much of it as fits below the rim. Zero
// when the rules refuse the pour — an empty source, a full destination, or two colors that disagree.
export function pourAmount(from: Bottle, to: Bottle, capacity: number): number {
  const run = topRun(from)

  if (!run) {
    return 0
  }

  const landing = topRun(to)

  if (landing && landing.color !== run.color) {
    return 0
  }

  return Math.min(run.count, freeSpace(to, capacity))
}

// The board after a pour, or null when the move is against the rules. The bottles handed in are left
// as they were.
export function applyPour(bottles: Bottle[], move: Move, capacity: number): Bottle[] | null {
  if (move.from === move.to) {
    return null
  }

  const amount = pourAmount(bottles[move.from], bottles[move.to], capacity)

  if (amount === 0) {
    return null
  }

  const next = bottles.map((bottle) => [...bottle])
  const poured = next[move.from].splice(next[move.from].length - amount, amount)
  next[move.to].push(...poured)

  return next
}

export function legalMoves(bottles: Bottle[], capacity: number): Move[] {
  const moves: Move[] = []

  for (let from = 0; from < bottles.length; from += 1) {
    for (let to = 0; to < bottles.length; to += 1) {
      if (from !== to && pourAmount(bottles[from], bottles[to], capacity) > 0) {
        moves.push({ from, to })
      }
    }
  }

  return moves
}

// The goal: every bottle is either empty or filled to the rim with one color. Holding a color uniform but
// split across two part-filled bottles is not finished.
export function isSolved(bottles: Bottle[], capacity: number): boolean {
  return bottles.every(
    (bottle) =>
      bottle.length === 0 ||
      (bottle.length === capacity && bottle.every((color) => color === bottle[0])),
  )
}

export function newGameFromBottles(bottles: Bottle[], capacity: number, par: number | null = null): GameState {
  return { capacity, bottles, past: [], moves: 0, won: isSolved(bottles, capacity), par }
}

// A pour the rules refuse returns the same state object, so the view can skip the redraw.
export function pour(state: GameState, from: number, to: number): GameState {
  if (state.won) {
    return state
  }

  const bottles = applyPour(state.bottles, { from, to }, state.capacity)

  if (!bottles) {
    return state
  }

  return {
    ...state,
    bottles,
    past: [...state.past, state.bottles],
    moves: state.moves + 1,
    won: isSolved(bottles, state.capacity),
  }
}

export function undo(state: GameState): GameState {
  const previous = state.past[state.past.length - 1]

  if (!previous) {
    return state
  }

  return {
    ...state,
    bottles: previous,
    past: state.past.slice(0, -1),
    moves: state.moves - 1,
    won: isSolved(previous, state.capacity),
  }
}

function shuffled(values: number[], random: () => number): number[] {
  const next = [...values]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
  }

  return next
}

// Every layer of every color, shuffled and cut into full bottles, with the spare bottles left empty.
export function dealBottles(options: DealOptions, random: () => number = Math.random): Bottle[] {
  const sand: number[] = []

  for (let color = 0; color < options.colors; color += 1) {
    for (let layer = 0; layer < options.capacity; layer += 1) {
      sand.push(color)
    }
  }

  const mixed = shuffled(sand, random)
  const full = Array.from({ length: options.colors }, (_, bottle) =>
    mixed.slice(bottle * options.capacity, (bottle + 1) * options.capacity),
  )
  const spare = Array.from({ length: options.empties }, (): Bottle => [])

  return [...full, ...spare]
}

// Deal until the solver both finishes a board and needs minMoves pours to do it. With a single spare
// bottle a random deal is often unsolvable, and the ones that are solvable are often over in a few pours,
// so the solver — not the shuffle — decides which boards reach the player.
//
// If no deal clears minMoves, the first solvable one stands. If none was even solvable, the last deal
// goes out as it is; at the sizes this game uses, that does not happen.
export function newGame(
  options: Partial<GameOptions> = {},
  random: () => number = Math.random,
  maxAttempts = 1500,
): GameState {
  const deal = { ...DEFAULT_DEAL, ...options }
  const settings = { ...deal, minMoves: options.minMoves ?? defaultMinMoves(deal.colors, deal.capacity) }
  let easiest: GameState | null = null
  let lastDeal: Bottle[] = []

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastDeal = dealBottles(settings, random)
    const solution = solve(lastDeal, settings.capacity)

    if (!solution) {
      continue
    }

    const game = newGameFromBottles(lastDeal, settings.capacity, solution.length)

    if (solution.length >= settings.minMoves) {
      return game
    }

    easiest ??= game
  }

  return easiest ?? newGameFromBottles(lastDeal, settings.capacity)
}
