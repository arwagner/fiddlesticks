// Where FreeCell's places and cards sit at whatever width the page gives us (no DOM). The view both draws
// from this and hit-tests against it, so a tap always lands on the card the player aimed at.
import { CASCADE_COUNT, FOUNDATION_COUNT, FREE_CELL_COUNT, type GameState, type Place } from './freecell-logic'
import { pointInRect, type Rect } from './solitaire-rules'

export type { Rect } from './solitaire-rules'

// Sizes at scale 1, in canvas pixels.
export const CARD_W = 86
export const CARD_H = 120
export const GAP_X = 12
export const GAP_Y = 20 // between the top row and the cascades
export const MARGIN = 12
// The fan step a cascade uses while it has room.
export const FAN_STEP = 36
// The strip at the top of a card where its rank and suit are drawn. However long a cascade grows, its fan
// step never drops below this, so every card's rank and suit stay showing.
export const INDEX_H = 30
// How tall the board may grow. A cascade too long to fit at FAN_STEP closes up its fan to stay within it.
export const MAX_HEIGHT = 860

// Eight cascades side by side, a gap apart, with a margin either side.
const BOARD_W = CASCADE_COUNT * CARD_W + (CASCADE_COUNT - 1) * GAP_X + 2 * MARGIN
// Past this, a wider container only adds room either side of the board.
const MAX_SCALE = 1

export type Layout = {
  scale: number
  width: number // the container's
  cardW: number
  cardH: number
  gapX: number
  marginX: number // to the first column, so the board sits in the middle of the container
  marginY: number
  cascadeY: number // the top of every cascade's first card
  fanStep: number
  indexH: number
  maxHeight: number
}

export function freeCellLayout(containerWidth: number): Layout {
  const scale = Math.min(MAX_SCALE, containerWidth / BOARD_W)
  const marginY = MARGIN * scale

  return {
    scale,
    width: containerWidth,
    cardW: CARD_W * scale,
    cardH: CARD_H * scale,
    gapX: GAP_X * scale,
    marginX: (containerWidth - (BOARD_W - 2 * MARGIN) * scale) / 2,
    marginY,
    cascadeY: marginY + (CARD_H + GAP_Y) * scale,
    fanStep: FAN_STEP * scale,
    indexH: INDEX_H * scale,
    maxHeight: MAX_HEIGHT * scale,
  }
}

function columnX(column: number, layout: Layout): number {
  return layout.marginX + column * (layout.cardW + layout.gapX)
}

// The free cells take the top row's first four columns and the foundations its last four.
function placeColumn(place: Place): number {
  return place.kind === 'foundation' ? CASCADE_COUNT - FOUNDATION_COUNT + place.index : place.index
}

// Where a place's card sits, or the outline of its empty space; for a cascade, where its first card goes.
export function placeRect(place: Place, layout: Layout): Rect {
  return {
    x: columnX(placeColumn(place), layout),
    y: place.kind === 'cascade' ? layout.cascadeY : layout.marginY,
    w: layout.cardW,
    h: layout.cardH,
  }
}

// How far each card in a cascade of this many cards sits below the one before: FAN_STEP while the foot
// fits within the board's maximum height, closer when it would not, but never less than a card's index.
export function fanStep(cardCount: number, layout: Layout): number {
  if (cardCount < 2) {
    return layout.fanStep
  }

  const room = layout.maxHeight - layout.marginY - layout.cascadeY - layout.cardH
  const fitting = room / (cardCount - 1)

  return Math.max(layout.indexH, Math.min(layout.fanStep, fitting))
}

// The rectangle of every card in one cascade, from the first card dealt down to its foot.
export function cascadeCardRects(cascade: number, state: GameState, layout: Layout): Rect[] {
  const cards = state.cascades[cascade]
  const first = placeRect({ kind: 'cascade', index: cascade }, layout)
  const step = fanStep(cards.length, layout)

  return cards.map((_, index) => ({ ...first, y: first.y + index * step }))
}

// What a point is over: a place and, in a cascade with cards, the index of the card hit. cardIndex is null
// for a free cell, a foundation or an empty cascade.
export type Hit = { place: Place; cardIndex: number | null }

export function hitTest(point: { x: number; y: number }, state: GameState, layout: Layout): Hit | null {
  const topRow: Place[] = [
    ...Array.from({ length: FREE_CELL_COUNT }, (_, index): Place => ({ kind: 'free-cell', index })),
    ...Array.from({ length: FOUNDATION_COUNT }, (_, index): Place => ({ kind: 'foundation', index })),
  ]

  for (const place of topRow) {
    if (pointInRect(point.x, point.y, placeRect(place, layout))) {
      return { place, cardIndex: null }
    }
  }

  for (let index = 0; index < CASCADE_COUNT; index += 1) {
    const place: Place = { kind: 'cascade', index }
    const rects = cascadeCardRects(index, state, layout)

    if (rects.length === 0) {
      if (pointInRect(point.x, point.y, placeRect(place, layout))) {
        return { place, cardIndex: null }
      }
      continue
    }

    // From the foot up, so where cards overlap the one drawn on top, the lowest showing, wins.
    for (let cardIndex = rects.length - 1; cardIndex >= 0; cardIndex -= 1) {
      if (pointInRect(point.x, point.y, rects[cardIndex])) {
        return { place, cardIndex }
      }
    }
  }

  return null
}
