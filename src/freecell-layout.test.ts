import { test, expect } from 'vitest'
import { seeded } from './seeded.test-helper'
import { newGame, fullDeck, type GameState, type Place } from './freecell-logic'
import {
  freeCellLayout,
  placeRect,
  cascadeCardRects,
  fanStep,
  hitTest,
  boardHeight,
  type Rect,
} from './freecell-layout'

const PHONE = 360

const centre = (rect: Rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })

// A dealt game with its first cascade emptied out and a 20-card cascade in the second.
function withLongCascade(): GameState {
  const state = newGame(seeded(7))
  const deck = fullDeck()

  state.cascades[0] = []
  state.cascades[1] = deck.slice(0, 20)
  return state
}

test('all eight cascades fit side by side in a 360 px container', () => {
  const layout = freeCellLayout(PHONE)
  const first = placeRect({ kind: 'cascade', index: 0 }, layout)
  const last = placeRect({ kind: 'cascade', index: 7 }, layout)

  expect(first.x).toBeGreaterThanOrEqual(0)
  expect(last.x + last.w).toBeLessThanOrEqual(PHONE)
  expect(last.x).toBeGreaterThan(first.x + 6 * first.w)
})

test('the top row holds the free cells on the left and the foundations on the right, above the cascades', () => {
  const layout = freeCellLayout(800)

  for (let index = 0; index < 4; index += 1) {
    const freeCell = placeRect({ kind: 'free-cell', index }, layout)
    const foundation = placeRect({ kind: 'foundation', index }, layout)

    expect(freeCell.x).toBe(placeRect({ kind: 'cascade', index }, layout).x)
    expect(foundation.x).toBe(placeRect({ kind: 'cascade', index: index + 4 }, layout).x)
    expect(freeCell.y + freeCell.h).toBeLessThan(placeRect({ kind: 'cascade', index }, layout).y)
    expect(foundation.y).toBe(freeCell.y)
  }
})

test('the scale stops growing on a wide container, and the board sits in its middle', () => {
  const desktop = freeCellLayout(1200)
  const wider = freeCellLayout(2400)

  expect(wider.scale).toBe(desktop.scale)
  expect(wider.cardW).toBe(desktop.cardW)
  expect(desktop.scale).toBeGreaterThan(freeCellLayout(PHONE).scale)

  const first = placeRect({ kind: 'free-cell', index: 0 }, wider)
  const last = placeRect({ kind: 'foundation', index: 3 }, wider)

  expect(first.x).toBeCloseTo(2400 - (last.x + last.w), 5)
})

test('a short cascade fans its cards downwards at the full fan step', () => {
  const layout = freeCellLayout(800)
  const state = newGame(seeded(3))
  const rects = cascadeCardRects(0, state, layout)

  expect(rects).toHaveLength(7)
  expect(rects[0]).toEqual(placeRect({ kind: 'cascade', index: 0 }, layout))
  expect(rects[1].y - rects[0].y).toBeCloseTo(layout.fullFanStep, 5)
})

test.each([PHONE, 800, 1600])(
  'at %i px a 20-card cascade ends within the maximum height, its fan step no less than a card index',
  (width) => {
    const layout = freeCellLayout(width)
    const rects = cascadeCardRects(1, withLongCascade(), layout)
    const foot = rects[19]
    const step = rects[1].y - rects[0].y

    expect(foot.y + foot.h).toBeLessThanOrEqual(layout.maxHeight)
    expect(step).toBeLessThan(layout.fullFanStep)
    expect(step).toBeGreaterThanOrEqual(layout.indexH)
  },
)

test('a cascade too long to fit keeps the fan step at a card index, so no rank or suit is hidden', () => {
  const layout = freeCellLayout(800)

  expect(fanStep(60, layout)).toBe(layout.indexH)
})

test.each<Place>([
  { kind: 'free-cell', index: 0 },
  { kind: 'free-cell', index: 3 },
  { kind: 'foundation', index: 0 },
  { kind: 'foundation', index: 3 },
])('a point on $kind $index hits it', (place) => {
  const layout = freeCellLayout(PHONE)

  expect(hitTest(centre(placeRect(place, layout)), newGame(seeded(4)), layout)).toEqual({
    place,
    cardIndex: null,
  })
})

test('a point on an empty cascade hits the cascade, with no card', () => {
  const layout = freeCellLayout(PHONE)
  const state = withLongCascade()
  const point = centre(placeRect({ kind: 'cascade', index: 0 }, layout))

  expect(hitTest(point, state, layout)).toEqual({ place: { kind: 'cascade', index: 0 }, cardIndex: null })
})

test('a point on the index of a covered card hits that card, not the one above or below', () => {
  const layout = freeCellLayout(PHONE)
  const state = withLongCascade()
  const rects = cascadeCardRects(1, state, layout)
  const step = rects[6].y - rects[5].y
  const point = { x: rects[5].x + rects[5].w / 2, y: rects[5].y + step / 2 }

  expect(hitTest(point, state, layout)).toEqual({ place: { kind: 'cascade', index: 1 }, cardIndex: 5 })
})

test('a point lower down the foot card hits the foot', () => {
  const layout = freeCellLayout(800)
  const state = newGame(seeded(5))
  const foot = cascadeCardRects(2, state, layout)[6]

  expect(hitTest({ x: foot.x + 4, y: foot.y + foot.h - 4 }, state, layout)).toEqual({
    place: { kind: 'cascade', index: 2 },
    cardIndex: 6,
  })
})

test('points in the gaps between places hit nothing', () => {
  const layout = freeCellLayout(800)
  const state = newGame(seeded(6))
  const freeCell = placeRect({ kind: 'free-cell', index: 1 }, layout)
  const cascade = placeRect({ kind: 'cascade', index: 1 }, layout)
  const foot = cascadeCardRects(1, state, layout)[6]

  // Between two free cells, between the top row and the cascades, and below a cascade's foot.
  expect(hitTest({ x: freeCell.x + freeCell.w + layout.gapX / 2, y: freeCell.y + 10 }, state, layout)).toBeNull()
  expect(hitTest({ x: cascade.x + 10, y: (freeCell.y + freeCell.h + cascade.y) / 2 }, state, layout)).toBeNull()
  expect(hitTest({ x: foot.x + 10, y: foot.y + foot.h + 10 }, state, layout)).toBeNull()
})

test('the board reaches down to the foot of its longest cascade, and a margin below', () => {
  const layout = freeCellLayout(800)
  const state = withLongCascade()
  const foot = cascadeCardRects(1, state, layout).at(-1)!

  expect(boardHeight(state, layout)).toBe(foot.y + foot.h + layout.marginY)
  expect(boardHeight(state, layout)).toBeLessThanOrEqual(layout.maxHeight)
})

test('with every cascade empty the board still has room for one card in each', () => {
  const layout = freeCellLayout(800)
  const state = { ...newGame(seeded(8)), cascades: Array.from({ length: 8 }, () => []) }

  expect(boardHeight(state, layout)).toBe(layout.cascadeY + layout.cardH + layout.marginY)
})
