import { test, expect } from 'vitest'
import {
  type Card,
  type Suit,
  getResponsiveScale,
  MIN_BOARD_WIDTH,
  scaledLayout,
  pileX,
  tableauCardPositions,
  pointInRect,
  CARD_W,
  CARD_H,
} from './solitaire-rules'

function card(suit: Suit, rank: number, faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

test('feat-003/AC-12: getResponsiveScale scales with container width and floors at 0.5', () => {
  expect(getResponsiveScale(MIN_BOARD_WIDTH + 16)).toBeCloseTo(1, 5) // ~fits at scale 1 (16px padding)
  expect(getResponsiveScale(2 * MIN_BOARD_WIDTH + 16)).toBeCloseTo(2, 5) // wide → scales up
  expect(getResponsiveScale(10)).toBe(0.5) // very narrow clamps to the floor
  expect(getResponsiveScale(0)).toBe(0.5) // never smaller than 0.5
})

// gap-002 regression: hit-testing must use the SAME scaled coordinates the board draws in, so a pointer
// aimed at a card's drawn rect selects that card at every scale — not only at scale 1.
test('feat-003/AC-14: pointer targeting matches drawn card rects at scale != 1', () => {
  for (const scale of [0.5, 1, 1.6]) {
    const layout = scaledLayout(scale)
    const column = [card('spades', 7)]
    const x = pileX(3, layout)
    const y = tableauCardPositions(column, layout)[0]
    const rect = { x, y, w: layout.cardW, h: layout.cardH }

    // the drawn/hit-test rect scales with the layout (the exact bug that gap-002 fixed)
    expect(rect.w).toBeCloseTo(CARD_W * scale, 5)
    expect(rect.h).toBeCloseTo(CARD_H * scale, 5)

    // a pointer at the rect's centre selects this card...
    expect(pointInRect(x + layout.cardW / 2, y + layout.cardH / 2, rect)).toBe(true)
    // ...and does NOT fall into the neighbouring column's rect at the same scale
    const neighbour = { x: pileX(4, layout), y, w: layout.cardW, h: layout.cardH }
    expect(pointInRect(x + layout.cardW / 2, y + layout.cardH / 2, neighbour)).toBe(false)
  }
})
