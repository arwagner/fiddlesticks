import { test, expect } from 'vitest'
import {
  type Card,
  type Suit,
  buildDeck,
  dealFromDeck,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  validateDraggedRun,
  revealLast,
  foundationTotal,
  isWon,
  returnToSource,
} from './solitaire-rules'

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

test('feat-003/AC-1: deal gives columns of 1..7 cards, only the last face-up, 24 in stock', () => {
  const { stock, tableau } = dealFromDeck(buildDeck())
  expect(tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
  tableau.forEach((column) => {
    column.forEach((c, i) => expect(c.faceUp).toBe(i === column.length - 1))
  })
  expect(stock.length).toBe(24)
  expect(stock.length + tableau.reduce((n, column) => n + column.length, 0)).toBe(52)
})

test('feat-003/AC-11: re-dealing produces a fresh, full, valid layout (restart)', () => {
  for (const deal of [dealFromDeck(buildDeck()), dealFromDeck(buildDeck())]) {
    expect(deal.tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(deal.stock.length).toBe(24)
  }
})

test('feat-003/AC-3: foundations are not suit-locked, then build ascending same-suit', () => {
  expect(canPlaceOnFoundation([], card('spades', 1))).toBe(true) // any Ace onto empty
  expect(canPlaceOnFoundation([], card('hearts', 2))).toBe(false) // non-Ace onto empty
  const pile = [card('spades', 1)]
  expect(canPlaceOnFoundation(pile, card('spades', 2))).toBe(true) // next rank, same suit
  expect(canPlaceOnFoundation(pile, card('hearts', 2))).toBe(false) // wrong suit
  expect(canPlaceOnFoundation(pile, card('spades', 3))).toBe(false) // skips a rank
})

test('feat-003/AC-4: tableau placement is descending, alternating colour; empty takes a King', () => {
  expect(canPlaceOnTableau([], card('spades', 13))).toBe(true) // King onto empty
  expect(canPlaceOnTableau([], card('spades', 12))).toBe(false) // non-King onto empty
  const col = [card('spades', 7)] // black 7
  expect(canPlaceOnTableau(col, card('hearts', 6))).toBe(true) // red 6 on black 7
  expect(canPlaceOnTableau(col, card('clubs', 6))).toBe(false) // black on black
  expect(canPlaceOnTableau(col, card('hearts', 5))).toBe(false) // wrong rank
  expect(canPlaceOnTableau([card('spades', 7, false)], card('hearts', 6))).toBe(false) // face-down top
})

test('feat-003/AC-5: a draggable run must be contiguous descending alternating colour', () => {
  expect(validateDraggedRun([card('spades', 7), card('hearts', 6), card('clubs', 5)])).toBe(true)
  expect(validateDraggedRun([card('spades', 7), card('clubs', 6)])).toBe(false) // same colour
  expect(validateDraggedRun([card('spades', 7), card('hearts', 5)])).toBe(false) // rank gap
  expect(validateDraggedRun([card('spades', 7)])).toBe(true) // single card
})

test('feat-003/AC-7 and feat-003/AC-8: revealLast flips a face-down top card, and only then', () => {
  const col = [card('spades', 5, false)]
  expect(revealLast(col)).toBe(true)
  expect(col[0].faceUp).toBe(true)
  expect(revealLast(col)).toBe(false) // already face-up → no-op
  expect(revealLast([])).toBe(false) // empty → no-op
})

test('feat-003/AC-9: returnToSource restores dragged cards to their waste or tableau source', () => {
  const waste: Card[] = []
  const tableau: Card[][] = [[], [], [], [], [], [], []]
  returnToSource([card('hearts', 4)], { kind: 'waste' }, waste, tableau)
  expect(waste.map((c) => c.rank)).toEqual([4])
  returnToSource([card('spades', 7), card('hearts', 6)], { kind: 'tableau', col: 2, index: 0 }, waste, tableau)
  expect(tableau[2].map((c) => c.rank)).toEqual([7, 6])
})

test('feat-003/AC-10: the game is won only when all 52 cards are on the foundations', () => {
  const pile = (n: number) => Array.from({ length: n }, (_, i) => card('spades', (i % 13) + 1))
  expect(isWon({ hearts: pile(13), diamonds: pile(13), clubs: pile(13), spades: pile(13) })).toBe(true)
  const short = { hearts: pile(13), diamonds: pile(12), clubs: pile(13), spades: pile(13) }
  expect(foundationTotal(short)).toBe(51)
  expect(isWon(short)).toBe(false)
})
