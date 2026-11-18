// Pure Klondike rules & geometry for Canvas Solitaire (feat-003) — no canvas/DOM, so unit-testable.
// solitaire.ts owns rendering, pointer input, and state; it imports every rule/geometry helper here.

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export type Card = {
  id: string
  suit: Suit
  rank: number
  faceUp: boolean
}

export const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const rankLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
// Filled Unicode pips (U+2660..U+2666). Colour comes from cardColor, so the solid glyphs suit both.
export const suitLabels: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }

// Base (unscaled) layout constants.
export const CARD_W = 86
export const CARD_H = 120
export const GAP_X = 18
export const GAP_TOP = 24
export const TABLEAU_Y = 172
export const FACEDOWN_SHIFT = 12
// Fraction of the card height at which the rank+pip index sits (its text baseline). solitaire.ts draws
// against this and the fan below is derived from it.
export const INDEX_BASELINE = 0.36
// A face-up card in a tableau column must leave the card beneath it showing at least down to that
// index, plus a little air — otherwise the card on top clips the rank you need to read.
export const FACEUP_SHIFT = Math.round(CARD_H * INDEX_BASELINE) + 3

export function cardColor(card: Card): 'red' | 'black' {
  return card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'
}

// feat-003/AC-3: foundations are NOT suit-locked — any Ace starts an empty foundation, after which it
// builds up in that foundation's established suit.
export function canPlaceOnFoundation(pile: Card[], card: Card): boolean {
  if (pile.length === 0) {
    return card.rank === 1
  }

  const top = pile[pile.length - 1]
  return top.suit === card.suit && card.rank === top.rank + 1
}

// feat-003/AC-4: place onto a tableau column when one rank below and opposite colour of its face-up
// top card; an empty column accepts a King only.
export function canPlaceOnTableau(column: Card[], card: Card): boolean {
  const top = column[column.length - 1]

  if (!top) {
    return card.rank === 13
  }

  if (!top.faceUp) {
    return false
  }

  return cardColor(card) !== cardColor(top) && card.rank === top.rank - 1
}

// feat-003/AC-5: a run may be lifted only if it is a contiguous descending, alternating-colour sequence.
export function validateDraggedRun(cards: Card[]): boolean {
  if (cards.length <= 1) {
    return true
  }

  for (let index = 1; index < cards.length; index += 1) {
    const prev = cards[index - 1]
    const current = cards[index]

    if (cardColor(prev) === cardColor(current) || prev.rank !== current.rank + 1) {
      return false
    }
  }

  return true
}

// feat-003/AC-7, AC-8: flip a face-down top card (clicked, or newly exposed by a move). Returns whether
// a card was flipped.
export function revealLast(column: Card[]): boolean {
  const top = column[column.length - 1]

  if (top && !top.faceUp) {
    top.faceUp = true
    return true
  }

  return false
}

// feat-003/AC-10: total cards on the foundations; the game is won at 52.
export function foundationTotal(foundations: Record<Suit, Card[]>): number {
  return suits.reduce((total, suit) => total + foundations[suit].length, 0)
}

export function isWon(foundations: Record<Suit, Card[]>): boolean {
  return foundationTotal(foundations) === 52
}

// A full, ordered 52-card deck (deterministic ids), all face-down. solitaire.ts shuffles it at runtime.
export function buildDeck(): Card[] {
  return suits.flatMap((suit) =>
    Array.from({ length: 13 }, (_, rankIndex) => ({
      id: `${suit}-${rankIndex + 1}`,
      suit,
      rank: rankIndex + 1,
      faceUp: false,
    })),
  )
}

// feat-003/AC-1: Klondike deal — columns 0..6 get 1..7 cards, only each column's last face-up; the rest
// becomes the stock. Mutates dealt cards' faceUp; the source array is not modified.
export function dealFromDeck(deck: Card[]): { stock: Card[]; tableau: Card[][] } {
  const remaining = [...deck]
  const tableau: Card[][] = [[], [], [], [], [], [], []]

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = remaining.pop()

      if (!card) {
        throw new Error('Deck underflow while dealing')
      }

      card.faceUp = row === col
      tableau[col].push(card)
    }
  }

  return { stock: remaining, tableau }
}

// feat-003/AC-12: responsive scale derived from container width, floored at 0.5.
export const MIN_BOARD_WIDTH = GAP_TOP + 7 * CARD_W + 6 * GAP_X + GAP_TOP
export function getResponsiveScale(clientWidth: number): number {
  const containerWidth = clientWidth - 16
  return Math.max(0.5, containerWidth / MIN_BOARD_WIDTH)
}

// Scaled layout — every geometry value the board draws AND hit-tests against, at one scale. Sharing this
// between render and hit-testing is what keeps pointer targeting aligned at any scale (feat-003/AC-14).
export type Layout = {
  scale: number
  cardW: number
  cardH: number
  gapX: number
  gapTop: number
  tableauY: number
  facedownShift: number
  faceupShift: number
}

export function scaledLayout(scale: number): Layout {
  return {
    scale,
    cardW: CARD_W * scale,
    cardH: CARD_H * scale,
    gapX: GAP_X * scale,
    gapTop: GAP_TOP * scale,
    tableauY: TABLEAU_Y * scale,
    facedownShift: FACEDOWN_SHIFT * scale,
    faceupShift: FACEUP_SHIFT * scale,
  }
}

export function pileX(index: number, layout: Layout): number {
  return layout.gapTop + index * (layout.cardW + layout.gapX)
}

// Y offset of each card in a tableau column, at the given layout.
export function tableauCardPositions(column: Card[], layout: Layout): number[] {
  return column.map((_, index) => {
    let y = layout.tableauY

    for (let cursor = 0; cursor < index; cursor += 1) {
      y += column[cursor].faceUp ? layout.faceupShift : layout.facedownShift
    }

    return y
  })
}

export type Rect = { x: number; y: number; w: number; h: number }

// feat-003/AC-14: hit-test in the SAME scaled coordinates the board draws in.
export function pointInRect(x: number, y: number, shape: Rect): boolean {
  return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h
}

export type Source = { kind: 'waste' } | { kind: 'tableau'; col: number; index: number }

export type Foundations = Record<Suit, Card[]>

// feat-003/AC-2: turn the whole waste face-down back into the stock (unlimited passes).
export function recycleWaste(stock: Card[], waste: Card[]): void {
  while (waste.length > 0) {
    const card = waste.pop()

    if (!card) {
      break
    }

    card.faceUp = false
    stock.push(card)
  }
}

// feat-003/AC-2: draw one stock card face-up onto the waste; on an empty stock, recycle the waste.
export function drawStock(stock: Card[], waste: Card[]): void {
  const card = stock.pop()

  if (!card) {
    recycleWaste(stock, waste)
    return
  }

  card.faceUp = true
  waste.push(card)
}

export function moveWasteToFoundation(foundations: Foundations, waste: Card[], suit: Suit): boolean {
  const card = waste[waste.length - 1]

  if (!card || !canPlaceOnFoundation(foundations[suit], card)) {
    return false
  }

  waste.pop()
  foundations[suit].push(card)
  return true
}

export function moveTableauToFoundation(foundations: Foundations, tableau: Card[][], col: number, suit: Suit): boolean {
  const column = tableau[col]
  const card = column[column.length - 1]

  if (!card || !card.faceUp || !canPlaceOnFoundation(foundations[suit], card)) {
    return false
  }

  column.pop()
  foundations[suit].push(card)
  revealLast(column)
  return true
}

// feat-003/AC-6: clicking a foundation auto-plays an eligible card — from the waste first, else from the
// leftmost eligible tableau column top. Returns 'waste', the tableau column index, or null if nothing moved.
export function autoPlayToFoundation(
  foundations: Foundations,
  waste: Card[],
  tableau: Card[][],
  suit: Suit,
): 'waste' | number | null {
  if (moveWasteToFoundation(foundations, waste, suit)) {
    return 'waste'
  }

  for (let col = 0; col < tableau.length; col += 1) {
    if (moveTableauToFoundation(foundations, tableau, col, suit)) {
      return col
    }
  }

  return null
}

// The foundation slot that would accept this card, or null. Slots aren't suit-locked, so an Ace lands in
// the first empty one and every later card matches the slot its own suit already occupies.
export function findFoundationFor(foundations: Foundations, card: Card): Suit | null {
  for (const suit of suits) {
    if (canPlaceOnFoundation(foundations[suit], card)) {
      return suit
    }
  }

  return null
}

// Double-click shortcut for the drawn card: send the waste's top card to whichever foundation accepts
// it. Returns the slot it went to, or null if it had nowhere to go.
export function sendWasteToFoundationAuto(foundations: Foundations, waste: Card[]): Suit | null {
  const card = waste[waste.length - 1]

  if (!card) {
    return null
  }

  const suit = findFoundationFor(foundations, card)

  if (!suit) {
    return null
  }

  waste.pop()
  foundations[suit].push(card)
  return suit
}

// Double-click shortcut: send a column's exposed card straight to whichever foundation accepts it,
// flipping whatever it uncovered. Returns the slot it went to, or null if it had nowhere to go.
export function sendTableauTopToFoundation(foundations: Foundations, tableau: Card[][], col: number): Suit | null {
  const column = tableau[col]
  const card = column[column.length - 1]

  if (!card || !card.faceUp) {
    return null
  }

  const suit = findFoundationFor(foundations, card)

  if (!suit) {
    return null
  }

  column.pop()
  foundations[suit].push(card)
  revealLast(column)
  return suit
}

// feat-003/AC-9: an illegal drop returns the dragged cards to their source pile unchanged.
export function returnToSource(cards: Card[], source: Source, waste: Card[], tableau: Card[][]): void {
  if (source.kind === 'waste') {
    waste.push(...cards)
  } else {
    tableau[source.col].push(...cards)
  }
}
