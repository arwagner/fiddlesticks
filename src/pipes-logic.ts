// The rules of Pipes (no DOM). A tile is a 4-bit mask of its arms, and rotating it shifts the mask, so
// there is no separate rotation index. Two masks that look the same are the same: a straight turned 180°
// is the same tile.

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
    solved: isSolved(masks, source),
  }
}

export function newGame(size: number, random: () => number = Math.random): GameState {
  const solution = generateTree(size, random)

  return newGameFromBoards(solution, scramble(solution, random))
}

// Each move returns the same state when it changes nothing, so the view can skip a redraw.
export function rotate(state: GameState, r: number, c: number): GameState {
  if (state.solved) {
    return state
  }

  const masks = state.masks.map((row) => [...row])
  masks[r][c] = rotateCW(masks[r][c])

  return { ...state, masks, solved: isSolved(masks, state.source) }
}
