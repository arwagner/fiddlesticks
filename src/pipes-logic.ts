// The rules of Pipes (no DOM). A tile is a 4-bit mask of its arms, and rotating it shifts the mask, so
// there is no separate rotation index. Two masks that look the same are the same: a straight turned 180°
// is the same tile.

import { isDeducible, deduceRound } from './pipes-solver'

export const N = 1
export const E = 2
export const S = 4
export const W = 8

export type Kind = 'end' | 'straight' | 'corner' | 'tee'

export function rotateCW(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15
}

export function armCount(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1)
}

export function kindOf(mask: number): Kind {
  const arms = armCount(mask)

  if (arms === 1) {
    return 'end'
  }

  if (arms === 3) {
    return 'tee'
  }

  return mask === (N | S) || mask === (E | W) ? 'straight' : 'corner'
}

export type Cell = { r: number; c: number }

// Each arm with the step to the neighbour it faces, and the arm that neighbour needs to face back.
export const ARMS = [
  { bit: N, dr: -1, dc: 0, opposite: S },
  { bit: E, dr: 0, dc: 1, opposite: W },
  { bit: S, dr: 1, dc: 0, opposite: N },
  { bit: W, dr: 0, dc: -1, opposite: E },
] as const

function joined(masks: number[][], r: number, c: number, arm: (typeof ARMS)[number]): boolean {
  const neighbour = masks[r + arm.dr]?.[c + arm.dc]

  return (masks[r][c] & arm.bit) !== 0 && neighbour !== undefined && (neighbour & arm.opposite) !== 0
}

// How many joins each tile is from the source, or -1 for a tile that is not lit.
export function lightDepths(masks: number[][], source: Cell): number[][] {
  const depths = masks.map((row) => row.map(() => -1))
  const queue: Cell[] = [source]
  depths[source.r][source.c] = 0

  for (let head = 0; head < queue.length; head += 1) {
    const { r, c } = queue[head]

    for (const arm of ARMS) {
      if (joined(masks, r, c, arm) && depths[r + arm.dr][c + arm.dc] < 0) {
        depths[r + arm.dr][c + arm.dc] = depths[r][c] + 1
        queue.push({ r: r + arm.dr, c: c + arm.dc })
      }
    }
  }

  return depths
}

// Every arm with no join. The board does not wrap, so an arm facing the edge always counts.
export function looseEnds(masks: number[][]): number {
  let count = 0

  masks.forEach((row, r) =>
    row.forEach((mask, c) => {
      for (const arm of ARMS) {
        if (mask & arm.bit && !joined(masks, r, c, arm)) {
          count += 1
        }
      }
    }),
  )

  return count
}

// No loose ends alone would allow a loop plus a separate island. Requiring every tile lit too forces a
// single tree, and since each dealt board has one answer, that tree is the answer.
export function isSolved(masks: number[][], source: Cell): boolean {
  return looseEnds(masks) === 0 && lightDepths(masks, source).every((row) => row.every((depth) => depth >= 0))
}

export type GameState = {
  size: number
  source: Cell
  solution: number[][]
  masks: number[][]
  locked: boolean[][]
  // Each earlier position, newest last, so undo just pops one.
  past: { masks: number[][]; locked: boolean[][] }[]
  solved: boolean
}

export function sourceFor(size: number): Cell {
  const middle = Math.floor((size - 1) / 2)

  return { r: middle, c: middle }
}

// A random spanning tree grown out from the source, as in Simon Tatham's Net. Each step joins a tile in
// the tree to one outside it, so no loop can form. A tile with three arms takes no more, so there is never
// a cross, and that can't strand a tile: a stranded region would have to be walled in by tees, and that wall
// would itself be a loop.
export function generateTree(size: number, random: () => number): number[][] {
  const masks = Array.from({ length: size }, () => Array<number>(size).fill(0))
  const inTree = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const source = sourceFor(size)
  let possible: { r: number; c: number; arm: (typeof ARMS)[number] }[] = []

  function grow(r: number, c: number): void {
    inTree[r][c] = true
    // Nothing else may join this tile now, or it would close a loop.
    possible = possible.filter((p) => p.r + p.arm.dr !== r || p.c + p.arm.dc !== c)

    for (const arm of ARMS) {
      if (!inTree[r + arm.dr]?.[c + arm.dc] && masks[r + arm.dr]?.[c + arm.dc] !== undefined) {
        possible.push({ r, c, arm })
      }
    }
  }

  grow(source.r, source.c)

  while (possible.length > 0) {
    const { r, c, arm } = possible[Math.floor(random() * possible.length)]
    masks[r][c] |= arm.bit
    masks[r + arm.dr][c + arm.dc] |= arm.opposite

    if (armCount(masks[r][c]) === 3) {
      possible = possible.filter((p) => p.r !== r || p.c !== c)
    }

    grow(r + arm.dr, c + arm.dc)
  }

  return masks
}

// Every tile gets its own random rotation, so some start right by chance. Forcing every tile wrong would give
// deductions away, since a straight has only one wrong rotation. Only a deal that is already solved is
// thrown back.
export function scramble(solution: number[][], random: () => number): number[][] {
  const source = sourceFor(solution.length)

  for (;;) {
    const masks = solution.map((row) =>
      row.map((mask) => {
        let turned = mask

        for (let turns = Math.floor(random() * 4); turns > 0; turns -= 1) {
          turned = rotateCW(turned)
        }

        return turned
      }),
    )

    if (!isSolved(masks, source)) {
      return masks
    }
  }
}

export function newGameFromBoards(solution: number[][], masks: number[][]): GameState {
  const size = solution.length
  const source = sourceFor(size)

  return {
    size,
    source,
    solution: solution.map((row) => [...row]),
    masks: masks.map((row) => [...row]),
    locked: masks.map((row) => row.map(() => false)),
    past: [],
    solved: isSolved(masks, source),
  }
}

// A puzzle the player can finish by deduction alone, which also makes its answer the only one. About half of
// random 12×12 trees pass and a quarter at 15×15, and a test costs about a millisecond, so building fresh
// trees until one passes is cheap. If every attempt fails this returns the last tree, which may need a
// guess. The cap is high enough that this can't happen in practice.
export function generateSolvableTree(size: number, random: () => number, maxAttempts = 200): number[][] {
  let tree = generateTree(size, random)

  for (let attempt = 1; attempt < maxAttempts && !isDeducible(tree); attempt += 1) {
    tree = generateTree(size, random)
  }

  return tree
}

export function newGame(size: number, random: () => number = Math.random): GameState {
  const solution = generateSolvableTree(size, random)

  return newGameFromBoards(solution, scramble(solution, random))
}

// Each move returns the same state when it changes nothing, so the view can skip a redraw.
// A solved board is finished: it takes no more moves until a new deal.
export function rotate(state: GameState, r: number, c: number): GameState {
  if (state.solved || state.locked[r][c]) {
    return state
  }

  const masks = state.masks.map((row) => [...row])
  masks[r][c] = rotateCW(masks[r][c])

  return { ...state, masks, past: [...state.past, snapshot(state)], solved: isSolved(masks, state.source) }
}

// A lock only stops the tile turning. It has no say in whether the board is solved.
export function toggleLock(state: GameState, r: number, c: number): GameState {
  if (state.solved) {
    return state
  }

  const locked = state.locked.map((row) => [...row])
  locked[r][c] = !locked[r][c]

  return { ...state, locked, past: [...state.past, snapshot(state)] }
}

export function undo(state: GameState): GameState {
  const previous = state.past[state.past.length - 1]

  if (state.solved || !previous) {
    return state
  }

  return { ...state, ...previous, past: state.past.slice(0, -1), solved: isSolved(previous.masks, state.source) }
}

function snapshot(state: GameState): { masks: number[][]; locked: boolean[][] } {
  return { masks: state.masks, locked: state.locked }
}

// A tile the player could work out now, or a lock that is wrong.
export type Hint = { kind: 'wrong-lock'; r: number; c: number } | { kind: 'fix'; r: number; c: number; mask: number }

// A wrong lock comes first: deductions from it would be wrong, and the player could be stuck for good.
// Otherwise the hints are the tiles the solver fixes first, knowing only the border and the correct locks.
export function findHints(state: GameState): Hint[] {
  if (state.solved) {
    return []
  }

  const wrong: Hint[] = []

  state.locked.forEach((row, r) =>
    row.forEach((locked, c) => {
      if (locked && state.masks[r][c] !== state.solution[r][c]) {
        wrong.push({ kind: 'wrong-lock', r, c })
      }
    }),
  )

  if (wrong.length > 0) {
    return wrong
  }

  const givens = state.solution.map((row, r) => row.map((mask, c) => (state.locked[r][c] ? mask : null)))

  return deduceRound(state.solution, givens).map(({ r, c, mask }) => ({ kind: 'fix' as const, r, c, mask }))
}

// A fix turns the tile into place and locks it, as one step. A wrong lock is only pointed out.
export function applyHint(state: GameState, hint: Hint): GameState {
  if (state.solved || hint.kind !== 'fix') {
    return state
  }

  const masks = state.masks.map((row) => [...row])
  const locked = state.locked.map((row) => [...row])
  masks[hint.r][hint.c] = hint.mask
  locked[hint.r][hint.c] = true

  return { ...state, masks, locked, past: [...state.past, snapshot(state)], solved: isSolved(masks, state.source) }
}
