// Solves a Bridges puzzle by deduction alone, with no guessing (no DOM). For each neighbour pair it keeps
// the least and the most bridges the pair can have, from 0 to 2, and tightens them until a whole pass
// changes nothing. Settling every pair this way proves the answer is the only one, so answers are never
// counted. Simon Tatham's bridges.c works the same way.

import { MAX_LEVEL, bridgeCounts, connectedGroups, isSolved, type Puzzle } from './bridges-logic'

export type SolveStatus = 'solved' | 'stuck' | 'contradiction'

export type SolveResult = {
  status: SolveStatus
  lower: number[]
  upper: number[]
  // The pass on which each pair's level was settled, or -1 if it never was. A given is settled on pass 0.
  settledOnPass: number[]
}

// `givens` are the least each pair has, as the bridges a player has already laid. They are a floor rather
// than a fixed level, so a pair that still needs another bridge doesn't make the solver contradict itself.
export function solve(puzzle: Puzzle, givens: number[] = puzzle.pairs.map(() => 0)): SolveResult {
  const { islands, pairs, crossings } = puzzle
  const lower = [...givens]
  const upper = pairs.map(() => MAX_LEVEL)
  const settledOnPass = pairs.map(() => -1)
  const touching = islands.map((): number[] => [])
  pairs.forEach((pair, p) => {
    touching[pair.a].push(p)
    touching[pair.b].push(p)
  })

  let pass = 0
  let changed = true
  let broken = false

  const raise = (p: number, level: number) => {
    if (level > lower[p]) {
      lower[p] = level
      changed = true
    }
  }

  const cap = (p: number, level: number) => {
    if (level < upper[p]) {
      upper[p] = level
      changed = true
    }
  }

  const markSettled = () =>
    pairs.forEach((_, p) => {
      if (lower[p] === upper[p] && settledOnPass[p] < 0) {
        settledOnPass[p] = pass
      }

      broken ||= lower[p] > upper[p]
    })

  // Whether some group short of every island would be closed off: each island in it already has its count.
  const closesOff = (levels: number[]) => {
    const groups = connectedGroups(puzzle, levels)
    const used = bridgeCounts(puzzle, levels)
    const open = new Set(groups.filter((_, i) => used[i] < islands[i].count))

    return new Set(groups).size > 1 && groups.some((group) => !open.has(group))
  }

  markSettled()

  while (changed && !broken) {
    changed = false
    pass += 1

    // Island capacity: the count has to fit between what the pairs must have and what they could have.
    islands.forEach((island, i) => {
      const most = touching[i].reduce((sum, p) => sum + upper[p], 0)
      const least = touching[i].reduce((sum, p) => sum + lower[p], 0)

      for (const p of touching[i]) {
        raise(p, island.count - (most - upper[p]))
        cap(p, island.count - (least - lower[p]))
      }
    })

    // Crossing: a pair that must have a bridge rules out every pair that crosses it.
    pairs.forEach((_, p) => {
      if (lower[p] > 0) {
        crossings[p].forEach((q) => cap(q, 0))
      }
    })

    // Isolation: one more bridge on a pair can't be the one that closes off a group of islands.
    pairs.forEach((_, p) => {
      if (lower[p] < upper[p]) {
        const levels = [...lower]
        levels[p] += 1

        if (closesOff(levels)) {
          cap(p, lower[p])
        }
      }
    })

    // A group of islands that isn't everything needs a way out. With only one pair left leaving it, that
    // pair has a bridge.
    const groups = connectedGroups(puzzle, lower)

    if (new Set(groups).size > 1) {
      const exits = new Map<number, number[]>()

      pairs.forEach((pair, p) => {
        if (upper[p] > 0 && groups[pair.a] !== groups[pair.b]) {
          for (const group of [groups[pair.a], groups[pair.b]]) {
            exits.set(group, [...(exits.get(group) ?? []), p])
          }
        }
      })

      new Set(groups).forEach((group) => {
        const ways = exits.get(group) ?? []

        if (ways.length === 0) {
          broken = true
        } else if (ways.length === 1) {
          raise(ways[0], 1)
        }
      })
    }

    markSettled()
  }

  const settled = lower.every((level, p) => level === upper[p])
  const status: SolveStatus =
    broken || (settled && !isSolved(puzzle, lower)) ? 'contradiction' : settled ? 'solved' : 'stuck'

  return { status, lower, upper, settledOnPass }
}
