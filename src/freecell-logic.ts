// Pure FreeCell rules: no canvas or DOM, so a test can call every entry point.
import { shuffled } from './shuffle'
import { suits, type Suit } from './solitaire-rules'

// Colour works the same as in Klondike; re-exported so FreeCell's code reads it from one module.
export { cardColor } from './solitaire-rules'

// One of the 52. FreeCell deals every card face up, so unlike Klondike's card it has no faceUp.
export type Card = { suit: Suit; rank: number }

// Any cascade, free cell or foundation: somewhere a card can be taken from or put down.
export type Place = { kind: 'cascade' | 'free-cell' | 'foundation'; index: number }

// Where every card is at one moment, without the history.
export type Arrangement = {
  cascades: Card[][] // 8, each listed from the head down to its foot
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
