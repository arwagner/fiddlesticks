// Pure FreeCell rules: no canvas or DOM, so a test can call every entry point.
import { shuffled } from './shuffle'
import { cardColor, suits, type Suit } from './solitaire-rules'

// Colour works the same as in Klondike; re-exported so FreeCell's code reads it from one module.
export { cardColor }

// One of the 52. FreeCell deals every card face up, so unlike Klondike's card it has no faceUp.
export type Card = { suit: Suit; rank: number }

// Any cascade, free cell or foundation: somewhere a card can be taken from or put down.
export type Place = { kind: 'cascade' | 'free-cell' | 'foundation'; index: number }

// Where every card is at one moment, without the history.
export type Arrangement = {
  cascades: Card[][] // 8, each listed from the first card dealt down to its foot
  freeCells: (Card | null)[] // 4
  foundations: Card[][] // 4, each built up from Ace
}

export type GameState = Arrangement & {
  // Each earlier arrangement, newest last, so undo just pops one.
  past: Arrangement[]
}

export const CASCADE_COUNT = 8
export const FREE_CELL_COUNT = 4
export const FOUNDATION_COUNT = 4

// The 52 cards in suit order, Ace to King within each suit.
export function fullDeck(): Card[] {
  return suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ suit, rank: index + 1 })))
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

const isEmptyCascade = (state: Arrangement, place: Place) =>
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

// Each card one rank below the one before it and the other colour.
function isSequence(cards: Card[]): boolean {
  return cards.every(
    (card, index) =>
      index === 0 || (card.rank === cards[index - 1].rank - 1 && cardColor(card) !== cardColor(cards[index - 1])),
  )
}

// The card that could be taken from `place` on its own: a cascade's foot, a free cell's card or a foundation's
// top card. Null when the place is empty or doesn't exist.
function cardAt(state: Arrangement, place: Place): Card | null {
  const pile =
    place.kind === 'cascade'
      ? state.cascades[place.index]
      : place.kind === 'foundation'
        ? state.foundations[place.index]
        : [state.freeCells[place.index]]

  return pile?.at(-1) ?? null
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

  const card = cardAt(state, from)

  return card ? [card] : null
}

// Whether `card` may go onto `foundation`: an Ace onto an empty one, otherwise the next rank of the same suit.
function goesOnFoundation(foundation: Card[], card: Card): boolean {
  const top = foundation.at(-1)

  return top ? card.suit === top.suit && card.rank === top.rank + 1 : card.rank === 1
}

// Whether `cards` may be put down on `to`, leaving capacity aside.
function canPutDown(state: GameState, cards: Card[], to: Place): boolean {
  const [first] = cards

  if (to.kind === 'cascade') {
    const foot = state.cascades[to.index]?.at(-1)

    if (!state.cascades[to.index]) {
      return false
    }

    return !foot || (first.rank === foot.rank - 1 && cardColor(first) !== cardColor(foot))
  }

  if (to.kind === 'free-cell') {
    return cards.length === 1 && state.freeCells[to.index] === null
  }

  const foundation = state.foundations[to.index]

  return !!foundation && cards.length === 1 && goesOnFoundation(foundation, first)
}

function arrangementOf(state: GameState): Arrangement {
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

  return { cascades, freeCells, foundations, past: [...state.past, arrangementOf(state)] }
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

// The foundation `card` can go onto now, or null if none will take it.
function foundationFor(state: Arrangement, card: Card): Place | null {
  const index = state.foundations.findIndex((foundation) => goesOnFoundation(foundation, card))

  return index === -1 ? null : { kind: 'foundation', index }
}

// A safe card can go onto its foundation and no card left in play could still need it: both cards of the
// other colour one rank lower are already on foundations. Aces and Twos are always safe.
export function isSafe(state: Arrangement, card: Card): boolean {
  if (!foundationFor(state, card)) {
    return false
  }

  if (card.rank <= 2) {
    return true
  }

  const onFoundations = state.foundations.flat()
  const otherColourBelow = suits.filter((suit) => cardColor({ suit }) !== cardColor(card))

  return otherColourBelow.every((suit) =>
    onFoundations.some((each) => each.suit === suit && each.rank === card.rank - 1),
  )
}

// Every place auto-play may take a card from: the foot of each cascade, then each free cell.
const autoPlaySources: Place[] = [
  ...Array.from({ length: CASCADE_COUNT }, (_, index): Place => ({ kind: 'cascade', index })),
  ...Array.from({ length: FREE_CELL_COUNT }, (_, index): Place => ({ kind: 'free-cell', index })),
]

// One safe card's move up to its foundation, or null if no card is safe.
function nextSafeMove(state: Arrangement): { from: Place; to: Place } | null {
  for (const from of autoPlaySources) {
    const card = cardAt(state, from)
    const to = card && isSafe(state, card) ? foundationFor(state, card) : null

    if (to) {
      return { from, to }
    }
  }

  return null
}

// Moves safe cards up to the foundations until none is left. Auto-play adds nothing to `past`, so the undo
// of the move before it takes the auto-play back too.
export function autoPlay(state: GameState): GameState {
  const step = nextSafeMove(state)
  const next = step && move(state, step.from, step.to, 1)

  return next ? autoPlay({ ...next, past: state.past }) : state
}

// The move the player makes: `move`, then auto-play. One undo takes back both. Returns null if the rules
// don't allow the move.
export function moveThenAutoPlay(state: GameState, from: Place, to: Place, count: number): GameState | null {
  const next = move(state, from, to, count)

  return next && autoPlay(next)
}
