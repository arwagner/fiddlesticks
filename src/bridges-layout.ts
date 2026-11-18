// Where islands and bridges sit on the board (no DOM). The board is drawn in cell units, one unit per cell,
// and scaled to whatever width the page gives it, so a 13×13 board fits a phone.

import type { Island, Puzzle } from './bridges-logic'

export type Point = { x: number; y: number }

export type Segment = { from: Point; to: Point }

export const ISLAND_RADIUS = 0.4
// How far from its centre a press still lands on an island. Under half the diagonal between cells.
export const HIT_RADIUS = 0.7
// Water all round the board, so an island in the outer cells isn't up against the frame.
const MARGIN = 0.25

export function viewBox(size: number): string {
  return `${-MARGIN} ${-MARGIN} ${size + 2 * MARGIN} ${size + 2 * MARGIN}`
}
// How far each line of a double bridge sits from the line between the islands' centres.
const DOUBLE_OFFSET = 0.11

export function islandCentre(island: Island): Point {
  return { x: island.col + 0.5, y: island.row + 0.5 }
}

// One line for one bridge and two side by side for two, from centre to centre. The islands are drawn on
// top, so the ends hide under them.
export function bridgeLines(puzzle: Puzzle, p: number, level: number): Segment[] {
  const pair = puzzle.pairs[p]
  const from = islandCentre(puzzle.islands[pair.a])
  const to = islandCentre(puzzle.islands[pair.b])
  const offsets = level === 2 ? [-DOUBLE_OFFSET, DOUBLE_OFFSET] : level === 1 ? [0] : []
  const across = pair.orientation === 'across'

  return offsets.map((offset) => ({
    from: across ? { x: from.x, y: from.y + offset } : { x: from.x + offset, y: from.y },
    to: across ? { x: to.x, y: to.y + offset } : { x: to.x + offset, y: to.y },
  }))
}

// A point on the page as a point on the board, or null when the board takes up no room.
export function boardPoint(clientX: number, clientY: number, bounds: DOMRectReadOnly, size: number): Point | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }

  return {
    x: ((clientX - bounds.left) / bounds.width) * (size + 2 * MARGIN) - MARGIN,
    y: ((clientY - bounds.top) / bounds.height) * (size + 2 * MARGIN) - MARGIN,
  }
}
