// Pure FreeCell rules: no canvas or DOM, so a test can call every entry point.
import { cardColor, suits, type Suit } from './solitaire-rules'

// Colour works the same as in Klondike; re-exported so FreeCell's code reads it from one module.
export { cardColor }

// One of the 52. FreeCell deals every card face up, so unlike Klondike's card it has no faceUp.
export type Card = { suit: Suit; rank: number }

// Any cascade, free cell or foundation: somewhere a card can be taken from or put down.
export type Place = { kind: 'cascade' | 'free-cell' | 'foundation'; index: number }

// Where every card is, without the history.
export type Layout = {
  cascades: Card[][] // 8, each listed from the head down to its foot
  freeCells: (Card | null)[] // 4
  foundations: Card[][] // 4, each built up from Ace
}

export type GameState = Layout & {
  // Each earlier layout, newest last, so undo just pops one.
  past: Layout[]
}

export const CASCADE_COUNT = 8
export const FREE_CELL_COUNT = 4
export const FOUNDATION_COUNT = 4

// The 52 cards in suit order, Ace to King within each suit.
export function fullDeck(): Card[] {
  return suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ suit, rank: index + 1 })))
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const next = [...values]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
  }

  return next
}

// A shuffled deck dealt left to right in turn across the eight cascades, so the first four get 7 cards and
// the last four get 6.
export function newGame(random: () => number = Math.random): GameState {
  const cascades: Card[][] = Array.from({ length: CASCADE_COUNT }, () => [])

  shuffled(fullDeck(), random).forEach((card, index) => {
    cascades[index % CASCADE_COUNT].push(card)
  })

  return {
    cascades,
    freeCells: Array.from({ length: FREE_CELL_COUNT }, () => null),
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    past: [],
  }
}

const isEmptyCascade = (state: Layout, place: Place) =>
  place.kind === 'cascade' && state.cascades[place.index]?.length === 0

// The most cards one move can carry to `to`: (empty free cells + 1) × 2^(empty cascades), counting one fewer
// empty cascade when `to` is one. A free cell or a foundation only ever takes one card.
export function capacity(state: GameState, to: Place): number {
  if (to.kind !== 'cascade') {
    return 1
  }

  const emptyFreeCells = state.freeCells.filter((card) => card === null).length
  const emptyCascades = state.cascades.filter((cascade) => cascade.length === 0).length
  const usableCascades = emptyCascades - (isEmptyCascade(state, to) ? 1 : 0)

  return (emptyFreeCells + 1) * 2 ** usableCascades
}

// Whether `card` may lie on `below` in a cascade: one rank lower and the other colour.
function goesOnto(card: Card, below: Card): boolean {
  return card.rank === below.rank - 1 && cardColor(card) !== cardColor(below)
}

// Each card one rank below the one before it and the other colour.
function isSequence(cards: Card[]): boolean {
  return cards.every((card, index) => index === 0 || goesOnto(card, cards[index - 1]))
}

// The `count` cards a move would take from `from`, or null if the rules don't let them go together.
function cardsToTake(state: GameState, from: Place, count: number): Card[] | null {
  if (from.kind === 'cascade') {
    const cascade = state.cascades[from.index]

    if (!cascade || count > cascade.length) {
      return null
    }

    const cards = cascade.slice(cascade.length - count)

    return isSequence(cards) ? cards : null
  }

  if (count !== 1) {
    return null
  }

  const card = from.kind === 'free-cell' ? state.freeCells[from.index] : state.foundations[from.index]?.at(-1)

  return card ? [card] : null
}

// Whether `cards` may be put down on `to`, leaving capacity aside.
function canPutDown(state: GameState, cards: Card[], to: Place): boolean {
  const [first] = cards

  if (to.kind === 'cascade') {
    const cascade = state.cascades[to.index]

    if (!cascade) {
      return false
    }

    const foot = cascade.at(-1)

    return !foot || goesOnto(first, foot)
  }

  if (to.kind === 'free-cell') {
    return cards.length === 1 && state.freeCells[to.index] === null
  }

  const foundation = state.foundations[to.index]

  if (!foundation || cards.length !== 1) {
    return false
  }

  const top = foundation.at(-1)

  return top ? first.suit === top.suit && first.rank === top.rank + 1 : first.rank === 1
}

function layoutOf(state: GameState): Layout {
  return { cascades: state.cascades, freeCells: state.freeCells, foundations: state.foundations }
}

// Takes `count` cards from `from` and puts them on `to`, as one undoable step. Returns null if the rules
// don't allow it; never changes `state`.
export function move(state: GameState, from: Place, to: Place, count: number): GameState | null {
  if (count < 1 || (from.kind === to.kind && from.index === to.index)) {
    return null
  }

  const cards = cardsToTake(state, from, count)

  if (!cards || count > capacity(state, to) || !canPutDown(state, cards, to)) {
    return null
  }

  const cascades = state.cascades.map((cascade) => [...cascade])
  const freeCells = [...state.freeCells]
  const foundations = state.foundations.map((foundation) => [...foundation])

  if (from.kind === 'cascade') {
    cascades[from.index].splice(-count)
  } else if (from.kind === 'free-cell') {
    freeCells[from.index] = null
  } else {
    foundations[from.index].pop()
  }

  if (to.kind === 'cascade') {
    cascades[to.index].push(...cards)
  } else if (to.kind === 'free-cell') {
    freeCells[to.index] = cards[0]
  } else {
    foundations[to.index].push(cards[0])
  }

  return { cascades, freeCells, foundations, past: [...state.past, layoutOf(state)] }
}

// All 52 cards on the foundations.
export function isSolved(state: GameState): boolean {
  return state.foundations.reduce((total, foundation) => total + foundation.length, 0) === 52
}

// Goes back one move. With nothing in `past` there is nothing to go back to, so the state comes back as it is.
export function undo(state: GameState): GameState {
  const previous = state.past.at(-1)

  if (!previous) {
    return state
  }

  return { ...previous, past: state.past.slice(0, -1) }
}
