// A deduction-only solver for Pipes, ported from Simon Tatham's Net (net.c, net_solver) for a board that
// does not wrap and has no crosses. It never guesses: every rule only throws out rotations that can't be in
// any solution. So when it fixes every tile, that solution is the only one, and the generator keeps only
// trees it can finish. Solutions are never counted.
//
// Rules, applied to every tile until a full pass changes nothing:
// 1. Edge consistency: a rotation must open every edge known to be open and close every edge known closed.
// 2. Loop avoidance: a rotation must not open two new edges into one connected group, or one into its own.
// 3. Dead-end avoidance: a rotation whose every arm leads into a known dead end would close off a piece
//    smaller than the whole board.

import { rotateCW, ARMS } from './pipes-logic'

// A tile's fixed mask, or null where it is not known.
export type Givens = (number | null)[][]

export type SolveResult = {
  status: 'solved' | 'stuck' | 'contradiction'
  masks: (number | null)[][]
}

const UNKNOWN = 0
const OPEN = 1
const CLOSED = 2

// Bigger than any board, so it means "no bound known".
const UNBOUNDED = Number.POSITIVE_INFINITY

// The distinct rotations of a tile. A straight has two, every other kind four.
function rotationsOf(mask: number): number[] {
  const seen: number[] = []

  for (let turned = mask, turn = 0; turn < 4; turn += 1, turned = rotateCW(turned)) {
    if (!seen.includes(turned)) {
      seen.push(turned)
    }
  }

  return seen
}

type Solver = {
  // Runs one full pass over every tile. Returns the tiles it fixed, or null on a contradiction.
  pass: () => number[] | null
  candidates: number[][]
}

function createSolver(kinds: number[][], givens?: Givens): Solver {
  const size = kinds.length
  const area = size * size
  const neighbour = (index: number, arm: number): number => {
    const r = Math.floor(index / size) + ARMS[arm].dr
    const c = (index % size) + ARMS[arm].dc

    return r >= 0 && r < size && c >= 0 && c < size ? r * size + c : -1
  }

  const candidates = kinds.flat().map((mask, index) => {
    const given = givens?.[Math.floor(index / size)][index % size]

    return given === null || given === undefined ? rotationsOf(mask) : [given]
  })

  // edges[index * 4 + arm]. An edge on the border is closed from the start.
  const edges = new Array<number>(area * 4).fill(UNKNOWN)
  // bounds[index * 4 + arm]: at most this many tiles lie beyond the tile that way, in any solution.
  const bounds = new Array<number>(area * 4).fill(UNBOUNDED)
  const parent = Array.from({ length: area }, (_, index) => index)

  for (let index = 0; index < area; index += 1) {
    for (let arm = 0; arm < 4; arm += 1) {
      if (neighbour(index, arm) < 0) {
        edges[index * 4 + arm] = CLOSED
      }
    }
  }

  function group(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }

    return index
  }

  function setEdge(index: number, arm: number, state: number): void {
    const other = neighbour(index, arm)
    edges[index * 4 + arm] = state
    edges[other * 4 + ((arm + 2) % 4)] = state

    if (state === OPEN) {
      parent[group(index)] = group(other)
    }
  }

  // Tightens every bound until nothing moves. Going out of a tile through an arm reaches the neighbour,
  // plus whatever lies beyond the neighbour's other arms, in whichever rotation allows the most.
  // A work list, so a bound that tightens only revisits the bounds that read it.
  function updateBounds(): void {
    const queue: number[] = []
    const queued = new Uint8Array(area * 4)

    function enqueue(slot: number): void {
      if (!queued[slot]) {
        queued[slot] = 1
        queue.push(slot)
      }
    }

    for (let slot = 0; slot < area * 4; slot += 1) {
      enqueue(slot)
    }

    for (let head = 0; head < queue.length; head += 1) {
      const slot = queue[head]
      queued[slot] = 0
      const index = slot >> 2
      const arm = slot & 3
      const other = neighbour(index, arm)

      if (other < 0) {
        continue
      }

      const backArm = (arm + 2) % 4
      const back = ARMS[backArm].bit
      let most = 0

      for (const mask of candidates[other]) {
        if (!(mask & back)) {
          continue
        }

        let reach = 1

        for (let onward = 0; onward < 4; onward += 1) {
          if (onward !== backArm && mask & ARMS[onward].bit) {
            reach += bounds[other * 4 + onward]
          }
        }

        most = Math.max(most, reach)
      }

      if (most > 0 && most < bounds[slot]) {
        bounds[slot] = most

        // The bounds that read this one: going into this tile from any other side.
        for (let side = 0; side < 4; side += 1) {
          const from = neighbour(index, side)

          if (side !== arm && from >= 0) {
            enqueue(from * 4 + ((side + 2) % 4))
          }
        }
      }
    }
  }

  function allowed(index: number, mask: number): boolean {
    const ownGroup = group(index)
    const reached: number[] = []
    let deadEnds = 1
    let allDeadEnds = true

    for (let arm = 0; arm < 4; arm += 1) {
      const has = (mask & ARMS[arm].bit) !== 0
      const edge = edges[index * 4 + arm]

      if ((edge === OPEN && !has) || (edge === CLOSED && has)) {
        return false
      }

      if (!has) {
        continue
      }

      if (edge === UNKNOWN) {
        const into = group(neighbour(index, arm))

        if (into === ownGroup || reached.includes(into)) {
          return false
        }

        reached.push(into)
      }

      if (bounds[index * 4 + arm] === UNBOUNDED) {
        allDeadEnds = false
      } else {
        deadEnds += bounds[index * 4 + arm]
      }
    }

    return !(allDeadEnds && deadEnds < area)
  }

  function pass(): number[] | null {
    const fixed: number[] = []
    updateBounds()

    for (let index = 0; index < area; index += 1) {
      const before = candidates[index].length
      const kept = candidates[index].filter((mask) => allowed(index, mask))

      if (kept.length === 0) {
        return null
      }

      candidates[index] = kept

      if (kept.length === 1 && before > 1) {
        fixed.push(index)
      }

      // An edge every remaining rotation opens is open, and one none of them opens is closed.
      for (let arm = 0; arm < 4; arm += 1) {
        if (edges[index * 4 + arm] !== UNKNOWN) {
          continue
        }

        const bit = ARMS[arm].bit

        if (kept.every((mask) => mask & bit)) {
          setEdge(index, arm, OPEN)
        } else if (kept.every((mask) => !(mask & bit))) {
          setEdge(index, arm, CLOSED)
        }
      }
    }

    return fixed
  }

  return { pass, candidates }
}

function progressSignature(candidates: number[][]): number {
  return candidates.reduce((sum, list) => sum + list.length, 0)
}

export function solve(kinds: number[][], givens?: Givens): SolveResult {
  const size = kinds.length
  const solver = createSolver(kinds, givens)
  let remaining = progressSignature(solver.candidates)
  let contradiction = false

  for (;;) {
    if (solver.pass() === null) {
      contradiction = true
      break
    }

    const now = progressSignature(solver.candidates)

    if (now === remaining) {
      break
    }

    remaining = now
  }

  const masks = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const list = solver.candidates[r * size + c]
      return list.length === 1 ? list[0] : null
    }),
  )
  const status = contradiction ? 'contradiction' : masks.every((row) => row.every((mask) => mask !== null)) ? 'solved' : 'stuck'

  return { status, masks }
}

// The generator's filter: a tree is worth dealing only when deduction alone can finish it.
export function isDeducible(solution: number[][]): boolean {
  return solve(solution).status === 'solved'
}
