import { test, expect } from 'vitest'
import { type Card, type Suit, type Foundations, drawStock, autoPlayToFoundation } from './solitaire-rules'

function card(suit: Suit, rank: number, faceUp = false): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

function emptyFoundations(): Foundations {
  return { hearts: [], diamonds: [], clubs: [], spades: [] }
}

test('feat-003/AC-2: single-card draw to waste; empty stock recycles the whole waste face-down', () => {
  const stock = [card('spades', 1), card('spades', 2)]
  const waste: Card[] = []

  drawStock(stock, waste)
  expect(waste.length).toBe(1)
  expect(waste[waste.length - 1].faceUp).toBe(true) // drawn card is face-up
  expect(stock.length).toBe(1)

  drawStock(stock, waste)
  expect(stock.length).toBe(0)
  expect(waste.length).toBe(2)

  drawStock(stock, waste) // empty stock → recycle the whole waste, face-down
  expect(waste.length).toBe(0)
  expect(stock.length).toBe(2)
  expect(stock.every((c) => !c.faceUp)).toBe(true)

  expect(() => drawStock([], [])).not.toThrow() // empty stock AND waste → no-op
})

test('feat-003/AC-6: auto-play takes the waste first, else the leftmost eligible tableau column', () => {
  // waste has a placeable Ace, and so does a tableau column → the waste wins
  const f1 = emptyFoundations()
  const waste1 = [card('spades', 1, true)]
  const tableau1: Card[][] = [[card('spades', 1, true)], [], [], [], [], [], []]
  expect(autoPlayToFoundation(f1, waste1, tableau1, 'spades')).toBe('waste')
  expect(f1.spades.length).toBe(1)
  expect(waste1.length).toBe(0)

  // no waste candidate → the leftmost eligible column (col 2, not col 3) wins
  const f2 = emptyFoundations()
  const tableau2: Card[][] = [[], [], [card('hearts', 1, true)], [card('hearts', 1, true)], [], [], []]
  expect(autoPlayToFoundation(f2, [], tableau2, 'hearts')).toBe(2)
  expect(f2.hearts.length).toBe(1)
  expect(tableau2[2].length).toBe(0)

  // nothing eligible → null, no change
  expect(autoPlayToFoundation(emptyFoundations(), [], [[], [], [], [], [], [], []], 'clubs')).toBe(null)
})
