// Where the bottles stand on the shelf at whatever width the page gives us (no DOM). decant.ts both draws
// from this and hit-tests against it, so a click always lands on the bottle the player aimed at.

export type Rect = { x: number; y: number; w: number; h: number }

// Sizes at scale 1, in canvas pixels.
export const BOTTLE_W = 76
export const LAYER_H = 30
export const NECK_H = 26 // clear glass above the sand, where the lip is
export const GAP_X = 20
export const GAP_Y = 30
export const MARGIN = 18
export const WALL = 4

// Room above the top row for a bottle that is tilted over its neighbour mid-pour, as a share of a
// bottle's height.
export const POUR_HEADROOM = 0.42

// Fewer than three bottles to a row wastes the shelf even on a phone.
export const MIN_PER_ROW = 3

const MIN_SCALE = 0.55
const MAX_SCALE = 1.25
// Below this, the shelf wraps another row rather than shrinking the bottles further.
const COMFORTABLE_SCALE = 0.9

export type Layout = {
  scale: number
  perRow: number
  capacity: number
  bottleW: number
  bottleH: number
  layerH: number
  neckH: number
  wall: number
  gapX: number
  gapY: number
  marginX: number
  marginY: number
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function scaleForRow(perRow: number, containerWidth: number): number {
  const needed = perRow * BOTTLE_W + (perRow - 1) * GAP_X + 2 * MARGIN

  return clamp(containerWidth / needed, MIN_SCALE, MAX_SCALE)
}

export function shelfLayout(count: number, capacity: number, containerWidth: number): Layout {
  let rows = 1
  let perRow = Math.max(MIN_PER_ROW, count)

  while (perRow > MIN_PER_ROW && scaleForRow(perRow, containerWidth) < COMFORTABLE_SCALE) {
    rows += 1
    perRow = Math.max(MIN_PER_ROW, Math.ceil(count / rows))
  }

  const scale = scaleForRow(perRow, containerWidth)
  const bottleW = BOTTLE_W * scale
  const bottleH = (NECK_H + capacity * LAYER_H) * scale
  const columns = Math.min(Math.max(count, 1), perRow)
  const shelfWidth = columns * bottleW + (columns - 1) * GAP_X * scale

  return {
    scale,
    perRow,
    capacity,
    bottleW,
    bottleH,
    layerH: LAYER_H * scale,
    neckH: NECK_H * scale,
    wall: WALL * scale,
    gapX: GAP_X * scale,
    gapY: GAP_Y * scale,
    // Spare width goes either side, so the shelf sits in the middle of whatever it is given.
    marginX: Math.max(MARGIN * scale, (containerWidth - shelfWidth) / 2),
    marginY: MARGIN * scale + POUR_HEADROOM * bottleH,
  }
}

export function bottleRect(index: number, layout: Layout): Rect {
  const row = Math.floor(index / layout.perRow)
  const column = index % layout.perRow

  return {
    x: layout.marginX + column * (layout.bottleW + layout.gapX),
    y: layout.marginY + row * (layout.bottleH + layout.gapY),
    w: layout.bottleW,
    h: layout.bottleH,
  }
}

// One layer of sand, counted from the bottom of the bottle up, sitting inside the glass. Takes the
// bottle's rect rather than its index, so it also places sand in a bottle being drawn mid-pour, away
// from its slot on the shelf.
export function bandInRect(bottle: Rect, layer: number, layout: Layout): Rect {
  return {
    x: bottle.x + layout.wall,
    y: bottle.y + bottle.h - layout.wall - (layer + 1) * layout.layerH,
    w: bottle.w - 2 * layout.wall,
    h: layout.layerH,
  }
}

export function bandRect(index: number, layer: number, layout: Layout): Rect {
  return bandInRect(bottleRect(index, layout), layer, layout)
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function bottleAt(x: number, y: number, count: number, layout: Layout): number | null {
  for (let index = 0; index < count; index += 1) {
    if (pointInRect(x, y, bottleRect(index, layout))) {
      return index
    }
  }

  return null
}

export function boardSize(count: number, layout: Layout): { width: number; height: number } {
  const rows = Math.ceil(count / layout.perRow)
  const columns = Math.min(count, layout.perRow)

  return {
    width: 2 * layout.marginX + columns * layout.bottleW + (columns - 1) * layout.gapX,
    height: layout.marginY + rows * layout.bottleH + (rows - 1) * layout.gapY + MARGIN * layout.scale,
  }
}
