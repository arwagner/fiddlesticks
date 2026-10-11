import { test, expect } from 'vitest'
import {
  shelfLayout,
  bottleRect,
  bandRect,
  bottleAt,
  boardSize,
  BOTTLE_W,
  MIN_PER_ROW,
} from './decant-layout'

const WIDE = 1200
const NARROW = 320

test('a wide shelf holds every bottle in one row', () => {
  const layout = shelfLayout(7, 5, WIDE)

  expect(layout.perRow).toBe(7)
  expect(bottleRect(6, layout).y).toBe(bottleRect(0, layout).y)
})

test('a narrow shelf wraps into rows instead of shrinking the bottles away', () => {
  const layout = shelfLayout(7, 5, NARROW)

  expect(layout.perRow).toBeLessThan(7)
  expect(layout.perRow).toBeGreaterThanOrEqual(MIN_PER_ROW)
  expect(layout.scale).toBeGreaterThan(0.5)

  const wrapped = bottleRect(layout.perRow, layout)

  expect(wrapped.x).toBe(bottleRect(0, layout).x)
  expect(wrapped.y).toBeGreaterThan(bottleRect(0, layout).y)
})

test('bottles in a row sit a gap apart and scale together', () => {
  const layout = shelfLayout(7, 5, WIDE)
  const first = bottleRect(0, layout)
  const second = bottleRect(1, layout)

  expect(first.w).toBeCloseTo(BOTTLE_W * layout.scale, 5)
  expect(second.x - first.x).toBeCloseTo(layout.bottleW + layout.gapX, 5)
})

test('layers stack from the bottom of the bottle up, inside its walls', () => {
  const layout = shelfLayout(4, 5, WIDE)
  const bottle = bottleRect(0, layout)
  const bottom = bandRect(0, 0, layout)
  const top = bandRect(0, 4, layout)

  expect(bottom.y + bottom.h).toBeCloseTo(bottle.y + bottle.h - layout.wall, 5)
  expect(top.y).toBeGreaterThan(bottle.y)
  expect(bottom.y - top.y).toBeCloseTo(4 * layout.layerH, 5)
  expect(bottom.x).toBeGreaterThan(bottle.x)
  expect(bottom.x + bottom.w).toBeLessThan(bottle.x + bottle.w)
})

// The same trap solitaire fell into: a hit test written in unscaled coordinates picks the wrong bottle
// everywhere except scale 1.
test('a click picks the bottle it landed on, at every scale', () => {
  for (const width of [NARROW, 700, WIDE]) {
    const layout = shelfLayout(7, 5, width)

    for (let index = 0; index < 7; index += 1) {
      const rect = bottleRect(index, layout)

      expect(bottleAt(rect.x + rect.w / 2, rect.y + rect.h / 2, 7, layout)).toBe(index)
    }
  }
})

test('a click on bare shelf picks no bottle', () => {
  const layout = shelfLayout(4, 5, WIDE)

  expect(bottleAt(0, 0, 4, layout)).toBeNull()
  expect(bottleAt(-50, -50, 4, layout)).toBeNull()
})

test('the board is big enough for every bottle it holds', () => {
  for (const width of [NARROW, WIDE]) {
    const layout = shelfLayout(9, 5, width)
    const size = boardSize(9, layout)
    const last = bottleRect(8, layout)

    expect(size.width).toBeGreaterThanOrEqual(last.x + last.w)
    expect(size.height).toBeGreaterThanOrEqual(last.y + last.h)
  }
})

test('the shelf keeps room above the top row for a bottle tilted over its neighbour', () => {
  const layout = shelfLayout(7, 5, WIDE)

  expect(bottleRect(0, layout).y).toBeGreaterThan(layout.bottleH / 2)
})
