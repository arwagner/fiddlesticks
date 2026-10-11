// An optimal solver for Decant (no DOM). decant-logic.ts uses it to throw out deals that cannot be
// finished, and deals that finish too soon; decant.ts uses it to answer a request for a hint.
//
// The search is IDA*: walk depth-first, but refuse any move whose pours so far, plus a lower bound on the
// pours still to come, exceed a threshold. When the walk finds nothing, raise the threshold to the
// cheapest move it refused and walk again. The first solution found is the shortest one, and the only
// memory the walk needs is the path it is standing on.

import { legalMoves, applyPour, isSolved, type Bottle, type Move } from './decant-logic'

// Bands of color in a bottle: [red, red, blue] shows two.
export function runCount(bottle: Bottle): number {
  let runs = 0

  for (let layer = 0; layer < bottle.length; layer += 1) {
    if (layer === 0 || bottle[layer] !== bottle[layer - 1]) {
      runs += 1
    }
  }

  return runs
}

// Every bottle on a finished board shows exactly one band, and a pour retires at most one band, so the
// surplus bands are pours that must still happen.
function surplusBands(bottles: Bottle[]): number {
  let runs = 0
  let occupied = 0

  for (const bottle of bottles) {
    runs += runCount(bottle)

    if (bottle.length > 0) {
      occupied += 1
    }
  }

  return runs - occupied
}

// Every color ends up in exactly one bottle, and a pour moves one color out of at most one bottle, so a
// color sitting in three bottles is at least two pours from home. This is what catches the board whose
// bands are all single-color but split between bottles — tidy, and still unfinished.
function surplusBottles(bottles: Bottle[]): number {
  const holders = new Map<number, number>()

  for (const bottle of bottles) {
    for (const color of new Set(bottle)) {
      holders.set(color, (holders.get(color) ?? 0) + 1)
    }
  }

  let surplus = 0

  for (const count of holders.values()) {
    surplus += count - 1
  }

  return surplus
}

// Neither bound ever overestimates, so the larger of the two is the bound to search on.
function poursLeftAtLeast(bottles: Bottle[]): number {
  return Math.max(surplusBands(bottles), surplusBottles(bottles))
}

// Bottles are interchangeable, so two boards holding the same bottles in a different order are the same
// board. Sorting folds them onto one key — which also drops the pointless move of tipping a whole
// single-color bottle into an empty one.
function boardKey(bottles: Bottle[]): string {
  return bottles
    .map((bottle) => bottle.join(','))
    .sort()
    .join('|')
}

// Boards near the limit of what one spare bottle allows can take a long walk. Past this many positions
// the deal is treated as one to throw back.
export const DEFAULT_BUDGET = 200_000

export function solve(bottles: Bottle[], capacity: number, budget = DEFAULT_BUDGET): Move[] | null {
  const path: Move[] = []
  let spent = 0
  let exhausted = false

  // null means the path now holds a solution. A number is the cheapest estimate this walk refused, which
  // becomes the next threshold.
  function walk(board: Bottle[], depth: number, threshold: number, seen: Map<string, number>): number | null {
    const estimate = depth + poursLeftAtLeast(board)

    if (estimate > threshold) {
      return estimate
    }

    if (isSolved(board, capacity)) {
      return null
    }

    spent += 1

    if (spent > budget) {
      exhausted = true
      return Infinity
    }

    let cheapestRefused = Infinity

    for (const move of legalMoves(board, capacity)) {
      const next = applyPour(board, move, capacity)

      if (!next) {
        continue
      }

      const key = boardKey(next)
      const bestKnown = seen.get(key)

      // Already reached this board by a route no longer than this one, so this route proves nothing new.
      if (bestKnown !== undefined && bestKnown <= depth + 1) {
        continue
      }

      seen.set(key, depth + 1)
      path.push(move)

      const refused = walk(next, depth + 1, threshold, seen)

      if (refused === null) {
        return null
      }

      path.pop()

      if (exhausted) {
        return Infinity
      }

      cheapestRefused = Math.min(cheapestRefused, refused)
    }

    return cheapestRefused
  }

  let threshold = poursLeftAtLeast(bottles)

  // Infinity means the last walk refused nothing and still found nothing: the board cannot be finished.
  while (threshold !== Infinity) {
    const refused = walk(bottles, 0, threshold, new Map([[boardKey(bottles), 0]]))

    if (refused === null) {
      return path
    }

    if (exhausted) {
      return null
    }

    threshold = refused
  }

  return null
}
